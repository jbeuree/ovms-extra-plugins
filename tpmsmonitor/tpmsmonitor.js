/*
 * /store/scripts/lib/tpmsmonitor.js
 * 
 * Module plugin:
 *  Provide low tire pressure warning notifications.
 *  Notifications will reset each day.
 * 
 * Version 1.0
 * 
 * Enable:
 *  - Install this script as /store/scripts/lib/tpmsmonitor.js
 *  - Add to /store/scripts/ovmsmain.js:
 *        tpmsmonitor = require("lib/tpmsmonitor");
 *  - script reload
 * 
 * Config:
 *  - usr tpmsmonitor.enabled         Master on/off switch
 *  - usr tpmsmonitor.min             Notifies if any tires go below this value
 *  - usr tpmsmonitor.max             Notifies if any tires go above this value
 *  - usr tpmsmonitor.deviation       Notifies if any 2 tires have a difference in pressure larger than this
 *  - usr tpmsmonitor.renotifyDrop    Will send additional notifications if the min pressure has dropped at least this amount from the last notification.
 *  - usr tpmsmonitor.units           Identifies if the values specified are in kPa (k) or psi (p)
 * 
 * 
 */

var cfg = {
  "enabled":  "false",
  "min":      "0",
  "max":      "0",
  "deviation": "0",
  "renotifyDrop": "0",
  "units":    "k",  // p (psi) or k (kPa)
};

var state = {
  running: false,            // If currently monitoring
  sent: false,
  sentMax: false,
  prevfr: 0.0,
  prevfl: 0.0,
  prevrr: 0.0,
  prevrl: 0.0,
  sentDay: 0,
  notifyMin: "0",
};

function kpaToPsi(kpaVal) {
  result = Math.round((parseFloat(kpaVal) + Number.EPSILON) * 1.45038)/10
  return result
}

// Read config:
function readconfig() {
  Object.assign(cfg, OvmsConfig.GetValues("usr", "tpmsmonitor."));
  if (cfg.enabled == "false" && state.running == "true") {
    exports.stopmonitoring()
  }
}

function setSent() {
  state.sent = true
  var d = new Date()
  state.sentDay = d.getDate()
}

function setSentMax() {
  state.sentMax = true;
  var d = new Date()
  state.sentDay = d.getDate()
}

function gettpmsvalue(key) {
  var metric = OvmsMetrics.Value(key)
  if (metric == "") {
    return null
  }
  if (cfg.units == 'p') {
    metric = kpaToPsi(metric)
  }
  return metric
}

function checkMinimumTirePressure(fltpms, frtpms, rltpms, rrtpms) {
  if (cfg.min == 0) {
    return
  }
  compareVal = cfg.min
  if (state.sent) {
    if (cfg.renotifyDrop > 0) {
      compareVal = state.notifyMin - cfg.renotifyDrop
      if (compareVal < 0) {
        compareVal = 0
      }
    }
  }
  err = "Low tire pressure warning: "
  low = false
  if (fltpms < compareVal) {
    err += "Front-Left(" + fltpms + ") "
    low = true
    state.notifyMin = fltpms
  }
  if (frtpms < compareVal) {
    err += "Front-Right(" + frtpms + ") "
    low = true
    if (frtpms < state.notifyMin || state.notifyMin == 0) {
      state.notifyMin = frtpms
    }
  }
  if (rltpms < compareVal) {
    err += "Rear-Left(" + rltpms + ") "
    low = true
    if (rltpms < state.notifyMin || state.notifyMin == 0) {
      state.notifyMin = rltpms
    }
  }
  if (rrtpms < compareVal) {
    err += "Rear-Right(" + rrtpms + ") "
    low = true
    if (rrtpms < state.notifyMin || state.notifyMin == 0) {
      state.notifyMin = rrtpms
    }
  }
  if (low) {
    // Raise an event
    OvmsNotify.Raise("alert", "usr.tpmsmonitor.lowtirepressure", err);
    setSent()
  }
}

function checkMaximumTirePressure(fltpms, frtpms, rltpms, rrtpms) {
  if (cfg.max == 0) {
    return
  }
  err = "High tire pressure warning: "
  high = false
  if (fltpms > cfg.max) {
    err += "Front-Left(" + fltpms + ") "
    high = true
  }
  if (frtpms > cfg.max) {
    err += "Front-Right(" + frtpms + ") "
    high = true
  }
  if (rltpms > cfg.max) {
    err += "Rear-Left(" + rltpms + ") "
    high = true
  }
  if (rrtpms > cfg.max) {
    err += "Rear-Right(" + rrtpms + ") "
    high = true
  }
  if (high && !state.sentMax) {
    // Raise an event
    OvmsNotify.Raise("alert", "usr.tpmsmonitor.lowtirepressure", err);
    setSentMax()
  }
}

function checkPressureDeviation(fltpms, frtpms, rltpms, rrtpms) {
  if (cfg.deviation == 0) {
    return
  }
  max = fltpms
  if (frtpms > max) {
    max = frtpms
  }
  if (rltpms > max) {
    max = rltpms
  }
  if (rrtpms > max) {
    max = rrtpms
  }

  err = "Tire pressure deviated too much from high (" + max + ") to low: "
  target = max - cfg.deviation
  low = false
  if (fltpms < target) {
    err += "Front-Left(" + fltpms + ") "
    low = true
  }
  if (frtpms < target) {
    err += "Front-Right(" + frtpms + ") "
    low = true
  }
  if (rltpms < target) {
    err += "Rear-Left(" + rltpms + ") "
    low = true
  }
  if (rrtpms < target) {
    err += "Rear-Right(" + rrtpms + ") "
    low = true
  }
  if (low && !state.sent) {
    // Raise an event
    OvmsNotify.Raise("alert", "usr.tpmsmonitor.lowtirepressure", err);
    setSent()
  }
}

function metricsUpdated(fltpms, frtpms, rltpms, rrtpms) {
  return(fltpms != null &&
         frtpms != null &&
         rltpms != null &&
         rrtpms != null &&
         fltpms == state.prevfl &&
         frtpms == state.prevfr &&
         rltpms == state.prevrl &&
         rrtpms == state.prevrr)
}

exports.monitortpms = function() {
  fltpms = gettpmsvalue("v.tp.fl.p")
  frtpms = gettpmsvalue("v.tp.fr.p")
  rltpms = gettpmsvalue("v.tp.rl.p")
  rrtpms = gettpmsvalue("v.tp.rr.p")

  // If nothing has changed, or there's no values, don't do any further checks
  if (metricsUpdated(fltpms, frtpms, rltpms, rrtpms)) {
    return;
  }
  state.prevfr = frtpms
  state.prevfl = fltpms
  state.prevrl = rltpms
  state.prevrr = rrtpms

  checkMinimumTirePressure(fltpms, frtpms, rltpms, rrtpms)
  checkPressureDeviation(fltpms, frtpms, rltpms, rrtpms)
  checkMaximumTirePressure(fltpms, frtpms, rltpms, rrtpms)
}

exports.startmonitoring = function() {
  if (cfg.enabled == "true" && state.running == false) {
    state.running = true
    PubSub.subscribe("ticker.60", function(){ exports.monitortpms(); })
  }
}

exports.stopmonitoring = function() {
  if (state.running) {
    state.running = false
    PubSub.unsubscribe("ticker.60")
  }
}

exports.setmin = function(minval) {
  cfg.min = minval
  OvmsConfig.Set("usr", "tpmsmonitor.min", minval)
}

exports.getmin = function() {
  if (typeof cfg.min === 'undefined') {
    return(0)
  } else {
    print(cfg.min)
  }
}

exports.setmax = function(maxval) {
  cfg.max = maxval
  OvmsConfig.Set("usr", "tpmsmonitor.max", maxval)
}

exports.getmax = function() {
  if (typeof cfg.max === 'undefined') {
    print(0)
  } else {
    print(cfg.max)
  }
}

exports.setenabled = function(enabled) {
  cfg.enabled = enabled
  OvmsConfig.Set("usr", "tpmsmonitor.enabled", enabled)
}

exports.getenabled = function() {
  if (typeof cfg.enabled === 'undefined') {
    print(false)
  } else {
    print(cfg.enabled)
  }
}

exports.setdeviation = function(deviation) {
  cfg.deviation = deviation
  OvmsConfig.Set("usr", "tpmsmonitor.deviation", deviation)
}

exports.getdeviation = function() {
  print(cfg.deviation)
}

exports.setunits = function(units) {
  cfg.units = units
  OvmsConfig.Set("usr", "tpmsmonitor.units", units)
}

exports.getunits = function() {
  if (typeof cfg.units === 'undefined') {
    print('k')
  } else {
    print(cfg.units)
  }
}

exports.setrenotifyDrop = function(value) {
  cfg.renotifyDrop = value
  OvmsConfig.Set("usr", "tpmsmonitor.renotifyDrop", value)
}

exports.getrenotifyDrop = function() {
  print(cfg.renotifyDrop)
}

exports.setConfig = function(min, renotify, max, deviation, units, enabled) {
  exports.setmin(min)
  exports.setmax(max)
  exports.setrenotifyDrop(renotify)
  exports.setdeviation(deviation)
  exports.setunits(units)
  exports.setenabled(enabled)
}

exports.checkResetFlags = function() {
  if (state.sentDay == 0) {
    return
  }
  // Reset the flags every day
  var d = new Date();
  var day = d.getDate();
  if (day != state.sendDay) {
    state.sent = false;
    state.sentMax = false;
    state.sentDay = 0
    state.notifyMin = 0
  }
}
  
// For testing/debugging
exports.clear = function() {
  state.prevfl = ""
  state.prevfr = ""
  state.prevrl = ""
  state.prevrr = ""
  state.sent = false
  state.sentMax = false
  state.notifyMin = 0
  state.sentDay = 0
}

exports.info = function() {
  JSON.print({ "cfg": cfg, "state": state })
}

// Init:
state.sentDay = 0
exports.clear()
readconfig()
PubSub.subscribe("config.changed", readconfig)

// Turn monitoring on/off based on if the vehicle is on
PubSub.subscribe("vehicle.off", function(){ exports.stopmonitoring(); })
PubSub.subscribe("vehicle.on", function(){ exports.startmonitoring(); })
PubSub.subscribe("clock.0600", function(){ exports.checkResetFlags(); })
