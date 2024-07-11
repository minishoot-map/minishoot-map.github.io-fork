import re
import json
import hashlib
import shutil

def remove(str):
    pat = r'^(.+?) [0-9]+'
    rep = r'\1'
    return re.sub(pat, rep, str)


def calculate_file_hash(file_path):
    md5_hash = hashlib.md5()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            md5_hash.update(byte_block)
    return md5_hash.hexdigest()

hashes = {}

with open('data.js', 'r') as f:
    data = json.load(f)
    for item in data:
        name = remove(item[2])
        if name not in hashes:
            hashes[name] = 0
            shutil.copy("sprites/" + item[2] + ".png", 'sprites-dedup/' + name + '.png')
