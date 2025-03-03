import uuid
import hashlib
import pymongo
import argparse
import time
from datetime import datetime

MONGODB_URI = "mongodb://localhost:27017/chatroom"
CODE_LENGTH = 8

def generate_code():
    timestamp = str(time.time()).encode('utf-8')

    unique_id = uuid.uuid4().hex.encode('utf-8')

    combined = timestamp + unique_id
    hash_object = hashlib.sha256(combined)
    hex_dig = hash_object.hexdigest()

    return hex_dig[:CODE_LENGTH]

def main():
    parser = argparse.ArgumentParser(description='生成内测邀请码')
    parser.add_argument('-c', '--count', type=int, help='要生成的邀请码数量')
    args = parser.parse_args()

    if args.count <= 0:
        print("错误：生成数量必须大于0")
        return

    client = pymongo.MongoClient(MONGODB_URI)
    db = client.get_default_database()
    invite_codes = db.invite_codes

    codes = []
    for _ in range(args.count):
        time.sleep(0.001)
        code = generate_code()

        invite_code = {
            "code": code,
            "created_at": datetime.utcnow()
        }
        invite_codes.insert_one(invite_code)
        codes.append(code)

    print(f"\n成功生成 {len(codes)} 个邀请码：")
    for code in codes:
        print(code)

if __name__ == "__main__":
    main()
