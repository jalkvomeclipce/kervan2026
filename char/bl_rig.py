# Kervan Yolu — insan iskeleti kur, ağırlıkla, animasyonları yap, GLB çıkar.
# Blender eksenleri: X = karakterin solu, -Y = karakterin önü, Z = yukarı.
import bpy, bmesh, math, sys
from mathutils import Vector, Quaternion, Matrix

bpy.ops.wm.open_mainfile(filepath='/home/claude/char/guard_prep.blend')
mesh = bpy.data.objects['guard']
V = [mesh.matrix_world @ v.co for v in mesh.data.vertices]

# --- eklem tahmini: konsept görselinden (1024 kırpım, boy 933 px = 1.8 m) ---
F = 1.8 / 933.0
def P(px, py, y=0.0): return Vector(((px - 512) * F, y, (978 - py) * F))
J = {
    'pelvis': P(512, 575), 'spine': P(512, 470), 'chest': P(512, 360), 'neck': P(512, 245), 'head': P(512, 205), 'headTop': P(512, 50),
    'shoulder_R': P(395, 292), 'elbow_R': P(322, 397), 'wrist_R': P(282, 500), 'handEnd_R': P(262, 570),
    'hip_R': P(464, 592), 'knee_R': P(434, 772), 'ankle_R': P(422, 905),
}
for k in list(J):
    if k.endswith('_R'):
        J[k[:-2] + '_L'] = Vector((-J[k].x, J[k].y, J[k].z))

def centroid(p, r):
    pts = [v for v in V if (v - p).length < r]
    if len(pts) < 8: return None
    return sum(pts, Vector()) / len(pts)

# yüzeye göre düzelt: kol ve bacak eklemleri tüpün ortasına, gövde eklemleri derinlikte ortaya
for k in J:
    p = J[k]
    if k.split('_')[0] in ('elbow', 'wrist', 'knee', 'ankle'):
        for _ in range(3):
            c = centroid(p, 0.07)
            if c: p = c
    elif k.split('_')[0] in ('shoulder', 'hip', 'handEnd'):
        c = centroid(p, 0.08)
        if c: p = Vector((p.x, c.y, p.z))
    else:
        # gövde: sadece derinlik (sırt çantasını hariç tutmak için önden yarım)
        pts = [v for v in V if abs(v.z - p.z) < 0.03 and abs(v.x) < 0.12]
        if pts:
            ys = sorted(v.y for v in pts); front = ys[0]
            p = Vector((0, front + 0.11 if k not in ('head', 'headTop', 'neck') else (ys[0] + ys[-1]) / 2, p.z))
    J[k] = p
J['handEnd_R'].x = min(J['handEnd_R'].x, J['wrist_R'].x - 0.02); J['handEnd_L'].x = max(J['handEnd_L'].x, J['wrist_L'].x + 0.02)
for k in sorted(J): print('joint', k, tuple(round(c, 3) for c in J[k]))

# --- iskelet ---
arm_data = bpy.data.armatures.new('rig'); arm = bpy.data.objects.new('rig', arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def bone(name, head, tail, parent=None, connect=False):
    b = eb.new(name); b.head = head; b.tail = tail
    if parent: b.parent = eb[parent]; b.use_connect = connect
    return b
bone('hips', J['pelvis'], J['spine'])
bone('spine', J['spine'], J['chest'], 'hips', True)
bone('chest', J['chest'], J['neck'], 'spine', True)
bone('neck', J['neck'], J['head'], 'chest', True)
bone('head', J['head'], J['headTop'], 'neck', True)
for s in ('R', 'L'):
    sh = J['shoulder_' + s]
    bone('clavicle_' + s, J['neck'] + Vector((0, 0, -0.05)), sh, 'chest')
    bone('upperarm_' + s, sh, J['elbow_' + s], 'clavicle_' + s, True)
    bone('forearm_' + s, J['elbow_' + s], J['wrist_' + s], 'upperarm_' + s, True)
    bone('hand_' + s, J['wrist_' + s], J['handEnd_' + s], 'forearm_' + s, True)
    bone('thigh_' + s, J['hip_' + s], J['knee_' + s], 'hips')
    bone('shin_' + s, J['knee_' + s], J['ankle_' + s], 'thigh_' + s, True)
    a = J['ankle_' + s]
    bone('foot_' + s, a, Vector((a.x, a.y - 0.17, 0.03)), 'shin_' + s, True)
bpy.ops.object.mode_set(mode='OBJECT')

# --- ağırlıklar (ısı yöntemi), eksik kalan köşelere en yakın kemik ---
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
vg_names = {g.index: g.name for g in mesh.vertex_groups}
missing = [v.index for v in mesh.data.vertices if sum(g.weight for g in v.groups) < 1e-4]
print('verts', len(mesh.data.vertices), 'without weight', len(missing))
if missing:
    segs = {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm_data.bones}
    def dseg(p, a, b):
        ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared)); return (a + ab * t - p).length
    for i in missing:
        p = mesh.matrix_world @ mesh.data.vertices[i].co
        best = min(segs, key=lambda n: dseg(p, *segs[n]))
        g = mesh.vertex_groups.get(best) or mesh.vertex_groups.new(name=best)
        g.add([i], 1.0, 'REPLACE')

# --- animasyonlar ---
pb = arm.pose.bones
REST = {b.name: b.bone.matrix_local.to_3x3() for b in pb}
AX = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}
def q_world(name, rots):
    q = Quaternion()
    M = REST[name]; Mi = M.inverted()
    for axis, deg in rots:
        la = (Mi @ AX[axis]).normalized()
        q = Quaternion(la, math.radians(deg)) @ q
    return q
def hips_offset(dz=0.0, dy=0.0):
    Mi = REST['hips'].inverted()
    return Mi @ Vector((0, dy, dz))

RELAX = 16  # A-pozundan kolları indir
def base_pose():
    return {
        'upperarm_R': [('Y', -RELAX)], 'upperarm_L': [('Y', RELAX)],
        'forearm_R': [('X', -12)], 'forearm_L': [('X', -12)],
    }
def merge(*ds):
    out = {}
    for d in ds:
        for k, v in d.items(): out.setdefault(k, []).extend(v)
    return out

def make_action(name, keys, loop=True):
    """keys: list of (frame, {bone: [(axis, deg)...]}, hips_dz, hips_dy)"""
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    for f, rots, dz, dy in keys:
        for b in pb:
            b.rotation_mode = 'QUATERNION'
            b.rotation_quaternion = q_world(b.name, rots.get(b.name, []))
            b.location = hips_offset(dz, dy) if b.name == 'hips' else Vector()
            b.keyframe_insert('rotation_quaternion', frame=f)
            if b.name == 'hips': b.keyframe_insert('location', frame=f)
    for fc in act.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
    return act

FPS = 30
bpy.context.scene.render.fps = FPS
acts = []
# Bekleme: nefes, hafif salınım (2 sn)
idle = []
for i, f in enumerate([1, 31, 61]):
    s = math.sin(i * math.pi)  # 0, 0, 0 for endpoints; mid uses breathe
    br = 1 if i == 1 else 0
    idle.append((f, merge(base_pose(), {'chest': [('X', -1.5 * br)], 'spine': [('X', 0.8 * br)], 'head': [('X', 1.5 * br), ('Z', 3 * br)],
                                         'upperarm_R': [('Y', -2 * br)], 'upperarm_L': [('Y', 2 * br)]}), -0.006 * br, 0))
acts.append(make_action('Idle', idle))
# Yürüme (1 sn)
def walk_pose(ph, amp_leg, amp_arm, knee, lean, bob, elbow):
    s = math.sin(ph); c = math.cos(ph)
    return merge(base_pose(), {
        'thigh_R': [('X', -amp_leg * s)], 'thigh_L': [('X', amp_leg * s)],
        'shin_R': [('X', knee * max(0, c) + 5)], 'shin_L': [('X', knee * max(0, -c) + 5)],
        'foot_R': [('X', -6 * s)], 'foot_L': [('X', 6 * s)],
        'upperarm_R': [('X', -amp_arm * -s)], 'upperarm_L': [('X', -amp_arm * s)],
        'forearm_R': [('X', -elbow)], 'forearm_L': [('X', -elbow)],
        'spine': [('X', lean), ('Z', 4 * s)], 'chest': [('Z', -5 * s)],
    }), -bob * abs(c), 0
walk = []
for k in range(5):
    ph = k / 4 * 2 * math.pi
    rots, dz, dy = walk_pose(ph, 26, 20, 38, 2, 0.025, 8)
    walk.append((1 + k * 7.5, rots, dz, dy))
acts.append(make_action('Walk', walk))
# Koşu (0.6 sn)
run = []
for k in range(5):
    ph = k / 4 * 2 * math.pi
    rots, dz, dy = walk_pose(ph, 42, 38, 75, 9, 0.05, 55)
    run.append((1 + k * 4.5, rots, dz, dy))
acts.append(make_action('Run', run))
# Kılıç saldırısı (0.7 sn): kaldır → indir → dön
B = base_pose()
atk = [
    (1, B, 0, 0),
    (6, merge(B, {'upperarm_R': [('X', -150), ('Y', 25)], 'forearm_R': [('X', -40)], 'spine': [('Z', -18)], 'chest': [('Z', -10)], 'upperarm_L': [('X', -25)]}), 0, 0),
    (11, merge(B, {'upperarm_R': [('X', -45), ('Y', -10)], 'forearm_R': [('X', -5)], 'spine': [('Z', 20), ('X', 8)], 'chest': [('Z', 12)], 'thigh_R': [('X', -15)], 'shin_R': [('X', 15)], 'upperarm_L': [('X', 15)]}), -0.04, 0),
    (16, merge(B, {'upperarm_R': [('X', -30)], 'forearm_R': [('X', -15)], 'spine': [('Z', 10), ('X', 4)]}), -0.02, 0),
    (22, B, 0, 0)]
acts.append(make_action('Attack', atk))
# Büyü (0.8 sn): iki kol öne-yukarı
cast = [
    (1, B, 0, 0),
    (8, merge(B, {'upperarm_R': [('X', -95), ('Y', 15)], 'upperarm_L': [('X', -95), ('Y', -15)], 'forearm_R': [('X', -15)], 'forearm_L': [('X', -15)], 'spine': [('X', -6)], 'head': [('X', -8)]}), 0, 0),
    (16, merge(B, {'upperarm_R': [('X', -80), ('Y', 5)], 'upperarm_L': [('X', -80), ('Y', -5)], 'forearm_R': [('X', -5)], 'forearm_L': [('X', -5)], 'spine': [('X', 4)]}), -0.01, 0),
    (25, B, 0, 0)]
acts.append(make_action('Cast', cast))
# Darbe alma (0.3 sn)
hit = [(1, B, 0, 0), (4, merge(B, {'spine': [('X', -10)], 'chest': [('X', -6)], 'head': [('X', -10)]}), 0, 0.02), (10, B, 0, 0)]
acts.append(make_action('Hit', hit))
# Ölme (1.2 sn): dizler kırılır, sırtüstü düşer
die = [
    (1, B, 0, 0),
    (9, merge(B, {'thigh_R': [('X', -25)], 'thigh_L': [('X', -20)], 'shin_R': [('X', 50)], 'shin_L': [('X', 45)], 'spine': [('X', 12)], 'head': [('X', 10)]}), -0.22, 0),
    (22, merge(B, {'hips': [('X', -78)], 'thigh_R': [('X', -30)], 'thigh_L': [('X', -10)], 'shin_R': [('X', 35)], 'shin_L': [('X', 15)],
                   'upperarm_R': [('Y', -40)], 'upperarm_L': [('Y', 45)], 'head': [('X', -15), ('Z', 20)]}), -0.62, 0.05),
    (36, merge(B, {'hips': [('X', -86)], 'thigh_R': [('X', -22)], 'thigh_L': [('X', -6)], 'shin_R': [('X', 28)], 'shin_L': [('X', 10)],
                   'upperarm_R': [('Y', -50)], 'upperarm_L': [('Y', 55)], 'head': [('X', -20), ('Z', 25)]}), -0.66, 0.05)]
acts.append(make_action('Die', die, loop=False))

# dinlenme pozuna dön, aksiyonları NLA'ya koy (glTF hepsini ayrı klip olarak yazar)
arm.animation_data.action = None
for b in pb: b.rotation_quaternion = Quaternion(); b.location = Vector()
for a in acts:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name
    st = tr.strips.new(a.name, int(a.frame_range[0]), a); st.name = a.name
    tr.mute = True
bpy.ops.wm.save_as_mainfile(filepath='/home/claude/char/guard_rig.blend')
print('actions', [a.name for a in acts])

# --- dışa aktar ---
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath='/home/claude/char/guard.glb', export_format='GLB', use_selection=True,
    export_image_format='JPEG', export_jpeg_quality=86, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_skins=True, export_all_influences=False, export_def_bones=False, export_yup=True, export_apply=False,
    export_force_sampling=True, export_frame_step=1, export_optimize_animation_size=True, export_reset_pose_bones=True)
import os; print('glb', os.path.getsize('/home/claude/char/guard.glb'))
