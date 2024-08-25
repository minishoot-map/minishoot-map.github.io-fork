import os
import io
import shutil
from PIL import Image

input_directory = '../raw/backgrounds'
output_directory = '../backgrounds'

os.makedirs(output_directory, exist_ok=True)

for filename in os.listdir(input_directory):
    input_path = os.path.join(input_directory, filename)
    output_path = os.path.join(output_directory, filename)

    if filename == 'backgrounds.js':
        shutil.copy(input_path, '../' + filename)

    if not filename.endswith('.png'):
        continue

    print(filename)

    if os.path.exists(output_path):
        continue

    image = Image.open(input_path)
    # tunrs out you can't have big canvases, have to scale down even more to fit into 16K x 16K max
    image = image.resize((image.width // 4, image.height // 4), Image.Resampling.HAMMING)

    if image.mode == 'RGBA':
        print('  rgba!') # all should be RGB
        image = image.convert('RGB')

    imageP = image.convert('P', palette=Image.ADAPTIVE)
    imageP.save(output_path, format='PNG', optimize=True, compress_level=9)

    # stream = io.BytesIO()
    # image.save(stream, format='PNG', optimize=True, compress_level=9)
    # streamP = io.BytesIO()
    # imageP.save(streamP, format='PNG', optimize=True, compress_level=9)
    # array = stream.getvalue()
    # arrayP = streamP.getvalue()
    # print('  ' + str(len(array)) + ' vs ' + str(len(arrayP)))
    # if len(array) < len(arrayP):
    #    print('  to rgb')
    #    with open(output_path, 'wb') as out_file:
    #        out_file.write(array)
    # else:
    #     print('  to palette')
    #     with open(output_path, 'wb') as out_file:
    #         out_file.write(arrayP)

    # image.save(output_path, format='PNG', optimize=True, compress_level=9)

print("Done!")
