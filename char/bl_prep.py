import bpy, bmesh, math, sys
from mathutils import Vector
TARGET_TRIS = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 14000
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/home/claude/char/trellis_raw.glb')
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
zs = [v.co.z for v in me.vertices]; zmin, zmax = min(zs), max(zs)
S = 1.8 / (zmax - zmin)
# center: x from full bounds, y from the legs (backpack shifts the full bounds)
legs = [v.co for v in me.vertices if v.co.z < zmin + (zmax - zmin) * 0.35]
cx = (min(v.co.x for v in me.vertices) + max(v.co.x for v in me.vertices)) / 2
cy = sum(v.y for v in legs) / len(legs)
for v in me.vertices:
    v.co = Vector(((v.co.x - cx) * S, (v.co.y - cy) * S, (v.co.z - zmin) * S))
me.update()
bm = bmesh.new(); bm.from_mesh(me)
nv = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(me); bm.free(); me.update()
print('welded', nv, '->', len(me.vertices))
print('scale', round(S, 3), 'tris before', sum(len(p.vertices) - 2 for p in me.polygons))
# decimate
mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = TARGET_TRIS / sum(len(p.vertices) - 2 for p in me.polygons); mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
print('tris after', sum(len(p.vertices) - 2 for p in ob.data.polygons), 'verts', len(ob.data.vertices))
# material: painted look (no metal), brightened base colour
mat = bpy.data.materials.new('kervan_guard'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
img = bpy.data.images.load('/home/claude/char/base_1024.png'); img.name = 'guard_base'
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Metallic'].default_value = 0.0; bsdf.inputs['Roughness'].default_value = 0.82
ob.data.materials.clear(); ob.data.materials.append(mat)
ob.name = 'guard'; ob.data.name = 'guard'
bpy.ops.wm.save_as_mainfile(filepath='/home/claude/char/guard_prep.blend')
print('saved')
