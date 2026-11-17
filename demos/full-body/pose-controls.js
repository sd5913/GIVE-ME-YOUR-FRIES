// MediaPipe Pose Landmarker indices in the order used by the camera preview.
const BODY_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BODY_BONES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],
  [23,24],[23,25],[25,27],[24,26],[26,28],[0,11],[0,12]];
const CALIBRATION_MS = 1000;
const TRACKING_MAX_AGE = 250;
const CROUCH_HOLD_MS = 120;
const REQUIRED_JOINTS = BODY_JOINTS.filter(i => i !== 13 && i !== 14);

function midpoint(a, b) {
  return {x:(a.x + b.x) / 2, y:(a.y + b.y) / 2};
}

function kneeAngle(hip, knee, ankle) {
  const a = Math.atan2(hip.y - knee.y, hip.x - knee.x);
  const b = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
  const gap = Math.abs(a - b);
  return Math.min(gap, Math.PI * 2 - gap) * 180 / Math.PI;
}

function readBody(landmarks, aspect) {
  if (!landmarks || !REQUIRED_JOINTS.every(i => {
    const joint = landmarks[i];
    return joint && (joint.visibility ?? 1) >= .52 &&
      joint.x > .015 && joint.x < .985 && joint.y > .015 && joint.y < .985;
  })) return null;

  const body = landmarks.map(joint => ({x:(1 - joint.x) * aspect, y:joint.y}));
  const shoulders = midpoint(body[11], body[12]);
  const hips = midpoint(body[23], body[24]);
  const ankles = midpoint(body[27], body[28]);
  const torso = Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y);
  const height = ankles.y - body[0].y;
  if (torso < .065 || height < .32) return null;

  return {
    x:hips.x * .75 + shoulders.x * .25,
    hipY:hips.y - ankles.y,
    knees:(kneeAngle(body[23], body[25], body[27]) + kneeAngle(body[24], body[26], body[28])) / 2,
    torso, height,
    arms:(body[15].y + body[16].y - body[11].y - body[12].y) / (2 * torso)
  };
}

function createCalibration() {
  return {startedAt:null, samples:[], baseline:null};
}

function addCalibrationSample(calibration, body, now) {
  const reference = calibration.samples[0];
  if (!body || body.height < .50 || body.knees < 155) {
    calibration.startedAt = null;
    calibration.samples.length = 0;
    return 0;
  }
  if (reference && (Math.abs(body.x - reference.x) > reference.torso * .26 ||
      Math.abs(body.hipY - reference.hipY) > reference.torso * .18 ||
      Math.abs(body.arms - reference.arms) > .22)) {
    calibration.startedAt = null;
    calibration.samples.length = 0;
  }
  calibration.startedAt ??= now;
  calibration.samples.push(body);
  const progress = Math.min(1, (now - calibration.startedAt) / CALIBRATION_MS);
  if (progress === 1) {
    const mean = field => calibration.samples.reduce((sum, sample) => sum + sample[field], 0) / calibration.samples.length;
    calibration.baseline = {x:mean('x'), hipY:mean('hipY'), torso:mean('torso'), arms:mean('arms')};
    calibration.samples.length = 0;
  }
  return progress;
}

function createBodyController() {
  return {crouching:false, pendingCrouchAt:null, needsStanding:true};
}

function bodyAxis(value, margin, negativeRange, positiveRange) {
  const offset = Math.max(0, Math.abs(value) - margin);
  const range = value < 0 ? negativeRange : positiveRange;
  return Math.sign(value) * Math.min(1, offset / range);
}

function bodyInput(controller, body, neutral, now) {
  const drop = (body.hipY - neutral.hipY) / neutral.torso;
  let released = false;
  if (controller.needsStanding) {
    if (drop < .17) controller.needsStanding = false;
  } else if (controller.crouching) {
    if (drop < .17) {
      controller.crouching = false;
      controller.pendingCrouchAt = null;
      released = true;
    }
  } else if (drop > .44 || (drop > .30 && body.knees < 151)) {
    controller.pendingCrouchAt ??= now;
    controller.crouching = now - controller.pendingCrouchAt >= CROUCH_HOLD_MS;
  } else {
    controller.pendingCrouchAt = null;
  }
  const shift = (body.x - neutral.x) / neutral.torso;
  const lift = body.arms - neutral.arms;
  return {
    horizontal:bodyAxis(shift, .10, 1.08, 1.08),
    vertical:bodyAxis(lift, .12, .62, .47),
    crouching:controller.crouching,
    released
  };
}
