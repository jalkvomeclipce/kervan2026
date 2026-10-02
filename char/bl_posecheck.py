import bpy, math
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/home/claude/char/guard_rig.blend')
sc = bpy.context.scene
arm = bpy.data.objects['rig']
sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.device = 'CPU'
sc.render.resolution_x = 300; sc.render.resolution_y = 400
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.8, 0.8, 0.83, 1)
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(45), 0, math.radians(-30))
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 2.3
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
a = math.radians(55)
co.location = Vector((math.sin(a) * 6, -math.cos(a) * 6, 1.0)); co.rotation_euler = (math.radians(90), 0, a)
outs = []
for act, frame in [('Idle', 31), ('Walk', 8), ('Run', 5), ('Attack', 6), ('Attack', 11), ('Cast', 8), ('Die', 36)]:
    arm.animation_data.action = bpy.data.actions[act]
    sc.frame_set(frame)
    sc.render.filepath = f'/home/claude/char/_p_{act}_{frame}.png'; bpy.ops.render.render(write_still=True); outs.append(sc.render.filepath)
from PIL import Image
ims = [Image.open(n) for n in outs]
o = Image.new('RGB', (sum(i.width for i in ims), ims[0].height)); x = 0
for i in ims: o.paste(i.convert('RGB'), (x, 0)); x += i.width
o.save('/home/claude/char/poses.png'); print('ok')
