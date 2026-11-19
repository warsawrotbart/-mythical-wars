"""Export visual meshes from the Mythic Wars Blender scene to the WebGL arena.

Run: blender -b scene.blend -t 4 --python tools/export_harbor_arena.py
Only scenery and physical rests are included. Live game objects are drawn in JS.
"""
from math import pow, sin
from pathlib import Path
from struct import Struct
from sys import argv

import bpy
from mathutils import Vector

OUT = Path(argv[argv.index("--") + 1]) if "--" in argv else Path("arena-art/harbor-draft.mwmesh")
FLOOR = .814
POS_SCALE = 256
VERTEX = Struct("<hhhBBBB")
HEADER = Struct("<4sI")
SUN = Vector((-.39, -.61, .69)).normalized()


def material_color(material):
    if material is None:
        return (.33, .24, .15)
    if material.use_nodes:
        shader = material.node_tree.nodes.get("Principled BSDF")
        if shader:
            return tuple(shader.inputs["Base Color"].default_value[:3])
    return tuple(material.diffuse_color[:3])


def surface_kind(name):
    if name.startswith("Река · рябь"):
        return 1
    if name.startswith("Окружение · дымка"):
        return 2
    if name.startswith("Известняк"):
        return 3
    if name.startswith(("Дерево", "Тёмные балки")):
        return 4
    return 0


def channel(value):
    return max(0, min(255, round(255 * pow(max(value, 0), 1 / 2.2))))


def objects(scene):
    for group in scene.collection.children:
        if group.name.startswith(("01", "02", "06")):
            yield from group.all_objects
        if group.name.startswith("04"):
            for obj in group.objects:
                if obj.name.startswith(("Часы · выносная опора", "Часы · стойка крепления", "Ложемент колоды")):
                    yield obj


def export(scene):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    payload = bytearray()
    for obj in objects(scene):
        if obj.type != "MESH" or obj.hide_render:
            continue
        # Small background meshes omit modifier evaluation. Near bevels contribute to the silhouette.
        evaluated = obj.evaluated_get(depsgraph) if obj.modifiers else obj
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            coords = [obj.matrix_world @ vertex.co for vertex in mesh.vertices]
            normal_matrix = obj.matrix_world.to_3x3().inverted_safe().transposed()
            palette = [(material_color(mat), surface_kind(mat.name if mat else "")) for mat in mesh.materials]
            for tri in mesh.loop_triangles:
                color, kind = palette[tri.material_index] if palette else ((.33, .24, .15), 0)
                normal = (normal_matrix @ tri.normal).normalized()
                light = .63 + .37 * max(0, normal.dot(SUN))
                for index in tri.vertices:
                    x, y, z = coords[index]
                    grain = 1 + .025 * sin(x * 9.6 + y * 3.6)
                    rgb = [channel(v * light * grain) for v in color]
                    position = [round(c * POS_SCALE) for c in (x, z - FLOOR, -y)]
                    payload += VERTEX.pack(*position, *rgb, kind)
        finally:
            evaluated.to_mesh_clear()
    assert payload and len(payload) % (3 * VERTEX.size) == 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(HEADER.pack(b"MWG1", len(payload) // VERTEX.size) + payload)
    print(f"Exported {len(payload) // (3 * VERTEX.size):,} triangles to {OUT}")


export(bpy.context.scene)
