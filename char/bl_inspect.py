import bpy, math, sys
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='trellis_raw.glb')
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in objs:
    print('mesh', o.name, 'verts', len(o.data.vertices), 'faces', len(o.data.polygons), 'mats', [m.name for m in o.data.materials])
    for m in o.data.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image: print('  tex', n.image.name, n.image.size[:])
# bounds
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print('bounds min', tuple(round(v, 3) for v in mn), 'max', tuple(round(v, 3) for v in mx))
ctr = (mn + mx) / 2; size = max(mx - mn)
# render 4 views with Cycles CPU
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.device = 'CPU'
sc.render.resolution_x = 400; sc.render.resolution_y = 520
sc.render.film_transparent = False
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.75, 0.75, 0.78, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(30))
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = size * 1.15
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
import os
for name, ang in [('front', 0), ('side', 90), ('back', 180), ('q', 35)]:
    a = math.radians(ang)
    # glTF import: +Y up in glTF becomes +Z up in Blender; model faces -Y in Blender typically
    d = Vector((math.sin(a), -math.cos(a), 0))
    co.location = ctr + d * size * 3
    co.rotation_euler = (math.radians(90), 0, a)
    sc.render.filepath = f'view_{name}.png'
    bpy.ops.render.render(write_still=True)
print('rendered')
