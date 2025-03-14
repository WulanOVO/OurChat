import random
import string
import pymongo
import argparse
import time
import os
from datetime import datetime

MONGODB_URI = os.environ.get('MONGODB_URI')
CODE_LENGTH = 8

def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=CODE_LENGTH))

def main():
    parser = argparse.ArgumentParser(description='生成内测邀请码')
    parser.add_argument('count', type=int, help='要生成的邀请码数量')
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
