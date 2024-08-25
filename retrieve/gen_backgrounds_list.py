import os
import json

input_directory = '../backgrounds'
output_path = '../backgrounds_list.js'

output = 'var background_names = [\n'
background = '#000000'

for filename in os.listdir(input_directory):
    if filename.endswith('.color'):
        background = filename[:-6]
    if filename.endswith('.png'):
        output = output + json.dumps(filename) + ',\n'

output = output + ']\n'
output = output + 'var backgroundColor = "' + background + '"\n'

# https://docs.python.org/3/library/functions.html#open see `newline`
with open(output_path, 'w', encoding='utf-8', newline='') as out_file:
    out_file.write(output)

print('Done!')
