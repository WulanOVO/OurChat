import paramiko
import os
import json
import tarfile
import fnmatch
import time
import tqdm


print('============开始部署============')

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with open('config.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

print('正在连接到服务器... ', end='')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

ssh.connect(
    hostname = config['ssh_host'],
    port = config['ssh_port'],
    username = config['ssh_user'],
    password = config['ssh_password'],
    pkey = paramiko.RSAKey.from_private_key_file(config['ssh_key_path'])
)

sftp = ssh.open_sftp()
shell = ssh.invoke_shell()
print('成功！')


source_dir = config['source_dir']
target_dir = config['target_dir']
exclude_patterns = config.get('exclude_patterns', [])
before_sync_commands = config.get('before_sync_commands', [])
after_sync_commands = config.get('after_sync_commands', [])

def exec_command(cmd):
    shell.send(cmd + '\n')
    output = ""
    while True:
        if shell.recv_ready():
            chunk = shell.recv(1024).decode('utf-8')
            output += chunk
            # 检查是否收到完整的命令输出
            if output.endswith('$ ') or output.endswith('# '):
                # 额外等待一小段时间，确保没有更多输出
                time.sleep(0.5)
                if not shell.recv_ready():
                    break
        time.sleep(0.1)

    output_lines = output.splitlines()
    cleaned_lines = []

    # 移除命令本身
    for line in output_lines:
        if line.strip() and not line.strip().startswith(cmd):
            cleaned_lines.append(line)
    # 移除最后的提示符
    if cleaned_lines and (cleaned_lines[-1].endswith('$ ') or cleaned_lines[-1].endswith('# ')):
        cleaned_lines.pop()

    return "\n".join(cleaned_lines).strip()

def should_exclude(file_path):
    rel_path = os.path.relpath(file_path, source_dir)

    for pattern in exclude_patterns:
        if fnmatch.fnmatch(rel_path, pattern) or fnmatch.fnmatch(os.path.basename(file_path), pattern):
            return True
    return False

exec_command(f'cd {target_dir}')

if before_sync_commands:
    print("执行同步前命令...", end='')
    for cmd in before_sync_commands:
        print(f'\n> {cmd}')
        print(exec_command(cmd))
        print()


print("清理目标目录... ", end='')
files = sftp.listdir_attr(target_dir)

for file in files:
    if file.filename not in ['.', '..'] and not should_exclude(file.filename):
        exec_command(f'sudo rm -rf {file.filename}')
print("成功！")


print("创建压缩包... ", end='')
tar_name = 'source.tar.gz'

with tarfile.open(tar_name, 'w:gz') as tar:
    for root, dirs, files in os.walk(source_dir):
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]

        for file in files:
            file_path = os.path.join(root, file)
            if not should_exclude(file_path):
                arcname = os.path.relpath(file_path, source_dir)
                tar.add(file_path, arcname=arcname)
print("成功！")


# 上传压缩包
filesize = os.path.getsize(tar_name)
with tqdm.tqdm(
    total=filesize, desc="上传进度", ncols=60,
    bar_format='{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt}'
) as pbar:
    def upload_progress(transferred, total):
        pbar.update(transferred - pbar.n)

    sftp.put(tar_name, f'{target_dir}/{tar_name}', callback=upload_progress)

time.sleep(1) # 等待上传完成

print("解压文件... ", end='')
exec_command(f'sudo tar -xzf {tar_name} -C {target_dir}')
exec_command(f'sudo chown -R {config["ssh_user"]} {target_dir}')
print("成功！")


print("清理临时文件... ", end='')
exec_command(f'sudo rm {tar_name}')
os.remove(tar_name)
print("成功！")


if after_sync_commands:
    print("执行同步后命令...", end='')
    for cmd in after_sync_commands:
        print(f'\n> {cmd}')
        print(exec_command(cmd))
        print()


print('============部署完成============')

sftp.close()
ssh.close()