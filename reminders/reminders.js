/*
 * /store/scripts/lib/reminders.js
 * 
 * Module plugin:
 *  Provide reminders to plug in or if a door was left open.
 * 
 * Version 1.0
 * 
 * Enable:
 *  - Install this script as /store/scripts/lib/reminders.js
 *  - Add to /store/scripts/ovmsmain.js:
 *        reminders = require("lib/reminders");
 *  - script reload
 * 
 * Config:
 *  - usr reminders.enabled         Master on/off switch
 *  - usr reminders.homeLocation    Name of the GPS location where the car should be plugged in
 *  - usr reminders.pluginTimeStart Time of day to remind to plug in
 *  - usr reminders.pluginTimeEnd   Time of day to remind to plug in
 *  - usr reminders.pluginTimeAllDay Time of day to remind to plug in
 *  - usr reminders.checkDelay      Amount of time to wait after arriving before reminding
 *  - usr reminders.targetCharge    Desired charge level - only notify if less than this
 *  - usr reminders.overrideNotificationCharge  Allow reminders outside of the start/end times if charge is less than this
 * 
 * 
 */

var cfg = {
  "enabled":          false,
  "homeLocation":     "",
  "pluginTimeStart":  "",
  "pluginTimeEnd":    "",
  "pluginTimeAllDay": true,
  "checkDelay":       "0",
  "targetCharge":     "0",
  "overrideNotificationCharge": "0",
};

var state = {
  monitoring:         false,
  enterLocationEvent: "",
  leaveLocationEvent: "",
  inLocation:         false,
  chargeReady:        false,
  timeMonitorEvent:   "",
};

// Read config:
function readconfig() {
  Object.assign(cfg, OvmsConfig.GetValues("usr", "reminders."));
  if (cfg.pluginTimeAllDay == "true") {
    cfg.pluginTimeAllDay = true
  } else if (cfg.pluginTimeAllDay == "false") {
    cfg.pluginTimeAllDay = false
  }
  if (cfg.enabled == "true") {
    cfg.enabled = true
    setupMonitoring()
  } else if (cfg.enabled == "false") {
    cfg.enabled = false
    stopMonitoring()
  }
}

function chargePilotOn() {
  state.chargeReady = true;
}

function chargePilotOff() {
  state.chargeReady = false;
}

function setupMonitoring() {
  // Remove and existing subscriptions that have changed
  var newEnterEvent = "location.enter." + cfg.homeLocation
  var newLeaveEvent = "location.leave." + cfg.homeLocation

  // Both events are constructed off the same location name - if one is different than both are
  if (state.enterLocationEvent != "" && !state.enterLocationEvent == newEnterEvent) {
    PubSub.unsubscribe(state.enterLocationEvent)
    PubSub.unsubscribe(state.leaveLocationEvent)
  }
 
  // Event name is based on the location name
  if (cfg.homeLocation == "") {
    // No location set to nothing to monitor
    state.enterLocationEvent = ""
    state.leaveLocationEvent = ""
    return
  }
  state.enterLocationEvent = newEnterEvent
  PubSub.subscribe(state.enterLocationEvent, function(){ exports.enteredLocation(); })

  state.leaveLocationEvent = newLeaveEvent
  PubSub.subscribe(state.leaveLocationEvent, function(){ exports.leftLocation(); })

  state.monitoring = true
}

function getDate(time) {
    var parseTime = time.split(":")

    var startDate = new Date()
    var hours = parseInt(parseTime[0])
    var minutes = parseInt(parseTime[1])
    var newDate = new Date()
    newDate.setHours(hours)
    newDate.setMinutes(minutes)

    return newDate;
}

function setTimeDelayCheck() {
  // ensure we're not currently subscribed to one
  clearTimeDelayCheck()

  // Need an event x minutes from now
  var now = new Date()
  var eventDate = new Date(now.getTime() + cfg.checkDelay * 60000)
  
  // Check if it falls inside the time window, otherwise need to set to the start of the window
  var useEventDate = (cfg.pluginTimeAllDay || (OvmsMetrics.Value("v.b.soc") < cfg.overrideNotificationCharge))
  if (! useEventDate) {
    var startDate = getDate(cfg.pluginTimeStart)
    var endDate = getDate(cfg.pluginTimeEnd)
    if ((eventDate > startDate && eventDate < endDate) ||   // Time window in the same day
        (eventDate > startDate && endDate < startDate)) {     // Time window goes overnight
      useEventDate = true;
    }
  }
  // Only need to check against the start of the time window. If it was past the end, the window would be moved to the next day
  if (useEventDate) {
    setDelayTimeSubscription(eventDate)
  } else {
    setDelayTimeSubscription(startDate)
  }
}

function setDelayTimeSubscription(eventDate) {
  var hours = eventDate.getHours()
  var minutes = eventDate.getMinutes()
    
  state.timeMonitorEvent = "clock."
  if (hours < 10) {
    state.timeMonitorEvent += "0"
  }
  state.timeMonitorEvent += hours
  if (minutes < 10) {
    state.timeMonitorEvent += "0"
  }
  state.timeMonitorEvent += minutes
  PubSub.subscribe(state.timeMonitorEvent, function(){ exports.delayTimeCheck(); })
}

function clearTimeDelayCheck() {
  if (state.timeMonitorEvent != "") {
    PubSub.unsubscribe(state.timeMonitorEvent)
    state.timeMonitorEvent = ""
  }
} 

function stopMonitoring() {
  if (state.monitoring) {
    PubSub.unsubscribe(state.enterLocationEvent)
    PubSub.unsubscribe(state.enterLocationEvent)
    clearTimeDelayCheck()
    state.monitoring = false
  }
}

exports.delayTimeCheck = function() {
  // Remove the subscription, then check if we need to notify
  clearTimeDelayCheck()

  var currentCharge = OvmsMetrics.Value("v.b.soc")
  // Ensure the state of charge is less than set
  if ((cfg.targetCharge > 0) &&
      (currentCharge >= cfg.targetCharge)) {
    return
  }

  // Check (1) location and (2) plug status
  if (state.inLocation && !state.chargeReady) {
    OvmsNotify.Raise("alert", "usr.reminders.plugin", "Vehicle at home location but not plugged in, charge at " + currentCharge);
  }
}

exports.enteredLocation = function() {
  state.inLocation = true
}

exports.vehicleOff = function() {
  setTimeDelayCheck()
}

exports.leftLocation = function() {
  state.inLocation = false
}

exports.vehicleOn = function() {
  clearTimeDelayCheck()
}

exports.setEnabled = function(enabled) {
  cfg.enabled = enabled
  OvmsConfig.Set("usr", "reminders.enabled", enabled)
  if (enabled) {
    setupMonitoring()
  } else {
    stopMonitoring()
  }
}

exports.getEnabled = function() {
  if (typeof cfg.enabled === 'undefined') {
    return(false)
  } else {
    print(cfg.enabled)
  }
}

exports.setHomeLocation = function(name) {
  cfg.homeLocation = name
  OvmsConfig.Set("usr", "reminders.homeLocation", name)
  setupMonitoring()
}

exports.getHomeLocation = function() {
  if (typeof cfg.homeLocation === 'undefined') {
    print("")
  } else {
    print(cfg.homeLocation)
  }
}

exports.setPluginTimes = function(timeStart, timeEnd, allDay) {
  if (timeStart.length == 4) {
    timeStart = "0" + timeStart
  }
  cfg.pluginTimeStart = timeStart
  OvmsConfig.Set("usr", "reminders.pluginTimeStart", timeStart)
  if (timeEnd.length == 4) {
    timeEnd = "0" + timeEnd
  }
  cfg.pluginTimeEnd = timeEnd
  OvmsConfig.Set("usr", "reminders.pluginTimeEnd", timeEnd)
  if (allDay == "true") {
    allDay = true
  } else {
    allDay = false
  }
  cfg.pluginTimeAllDay = allDay
  OvmsConfig.Set("usr", "reminders.pluginTimeAllDay", allDay)
}

exports.getPluginTimeStart = function() {
  if (typeof cfg.enabled === 'undefined') {
    print("")
  } else {
    print(cfg.pluginTimeStart)
  }
}

exports.getPluginTimeEnd = function() {
  if (typeof cfg.enabled === 'undefined') {
    print("")
  } else {
    print(cfg.pluginTimeEnd)
  }
}

exports.setCheckDelay = function(delay) {
  cfg.checkDelay = delay
  OvmsConfig.Set("usr", "reminders.checkDelay", delay)
}

exports.getCheckDelay = function() {
  if (typeof cfg.checkDelay === 'undefined') {
    print(0)
  } else {
    print(cfg.checkDelay)
  }

}

exports.setTargetCharge = function(target) {
  cfg.targetCharge = target
  OvmsConfig.Set("usr", "reminders.targetCharge", target)
}

exports.getTargetCharge = function() {
  if (typeof cfg.targetCharge === 'undefined') {
    print(0)
  } else {
    print(cfg.targetCharge)
  }

}

exports.setOverrideNotificationCharge = function(target) {
  cfg.overrideNotificationCharge = target
  OvmsConfig.Set("usr", "reminders.overrideNotificationCharge", target)
}

exports.getOverrideNotificationCharge = function() {
  if (typeof cfg.overrideNotificationCharge === 'undefined') {
    print(0)
  } else {
    print(cfg.overrideNotificationCharge)
  }

}

exports.info = function() {
  JSON.print({ "cfg": cfg, "state": state })
}

exports.setConfiguration = function(timeStart, timeEnd, delay, location, soc, socOverride, enabled, allDay) {
  exports.setPluginTimes(timeStart, timeEnd, allDay)
  exports.setCheckDelay(delay)
  exports.setHomeLocation(location)
  exports.setTargetCharge(soc)
  exports.setOverrideNotificationCharge(socOverride)
  exports.setEnabled(enabled)
}

// Init:
state.monitoring = false
readconfig()
PubSub.subscribe("config.changed", readconfig)
PubSub.subscribe("vehicle.charge.pilot.on", chargePilotOn)
PubSub.subscribe("vehicle.charge.pilot.off", chargePilotOff)
PubSub.subscribe("vehicle.off", function(){ exports.vehicleOff(); })
PubSub.subscribe("vehicle.on", function(){ exports.vehicleOn(); })
