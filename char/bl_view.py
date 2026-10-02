import bpy, math, sys
from mathutils import Vector
blend, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.device = 'CPU'
sc.render.resolution_x = 360; sc.render.resolution_y = 480
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.8, 0.8, 0.83, 1)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(45), 0, math.radians(-30))
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 2.1
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
import os
names = []
for name, ang in [('f', 0), ('q', 40), ('b', 180)]:
    a = math.radians(ang)
    co.location = Vector((math.sin(a) * 6, -math.cos(a) * 6, 0.95)); co.rotation_euler = (math.radians(90), 0, a)
    sc.render.filepath = f'/home/claude/char/_v_{name}.png'; bpy.ops.render.render(write_still=True); names.append(sc.render.filepath)
from PIL import Image
ims = [Image.open(n) for n in names]
o = Image.new('RGB', (sum(i.width for i in ims), ims[0].height)); x = 0
for i in ims: o.paste(i.convert('RGB'), (x, 0)); x += i.width
o.save(out)
