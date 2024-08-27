import json
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

def draw_triangles(array_of_triangles):
    fig, ax = plt.subplots()

    for triangle in array_of_triangles:
        triangle_patch = patches.Polygon(triangle, closed=True, edgecolor='black')
        ax.add_patch(triangle_patch)

    all_points = np.array([point for triangle in array_of_triangles for point in triangle])

    ax.set_xlim(all_points[:, 0].min() - 1, all_points[:, 0].max() + 1)
    ax.set_ylim(all_points[:, 1].min() - 1, all_points[:, 1].max() + 1)
    ax.set_aspect('equal')
    plt.show()

def load_triangles_from_json(filename):
    with open(filename, 'r') as file:
        triangles = json.load(file)
    return triangles

triangles = load_triangles_from_json('result.json')

draw_triangles(triangles)
