from pymongo import MongoClient
import json

client = MongoClient("mongodb://localhost:27017/")
db = client["ecg_db"]

print("--- USERS ---")
for u in db["users"].find().sort("_id", -1):
    print(f"{u['_id']} | {u.get('name')} | {u.get('email')}")

print("\n--- REPORTS ---")
for r in db["reports"].find().sort("timestamp", -1).limit(5):
    print(f"{r.get('timestamp')} | UserID: {r.get('userId')} | Record: {r.get('record')}")

client.close()
