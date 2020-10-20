# ovms-extra-plugins
Some additional [Open Vehicles Monitoring System](https://www.openvehicles.com/) plugins

## Reminders
This provides the ability to raise a notification as a reminder to plug in. It uses a set location to determine when the vehicle is parked at the desired charge location, and uses set times to determine when the notification should be sent.

When the conditions are met and vehicle is not plugged in, an alert/usr.reminders.plugin event will be raised.

### Installation
1. Save [reminders.js](https://raw.githubusercontent.com/jbeuree/ovms-extra-plugins/main/reminders/reminders.js) as /store/scripts/lib/reminders.js
2. Add line to /store/scripts/ovmsmain.js:
   * reminders = require("lib/reminders");
3. Issue script reload or evaluate the require line
4. Install [Reminders.htm web](https://raw.githubusercontent.com/jbeuree/ovms-extra-plugins/main/reminders/Reminders.htm) plugin, recommended setup:
   * Type: Page
   * Page: /usr/Reminders
   * Label: Reminders
   * Menu: Tools
   * Auth: Cookie

### Configuration

<img src="https://github.com/jbeuree/ovms-extra-plugins/raw/main/images/Reminders.png" width="600">

## TPMS Monitor
This provides simple monitoring of tire pressures. As no current event framework is provided for TPMS, this plugin will periodically poll for the current tire pressures. It provides the ability to notify if pressures beyond set values, or if too large a difference is seen between the tires. As this is poll based, it is not suitable for notifying immediate problems with tire pressures, and is instead more suitable for identifying gradual leaks.

This will raise alert/usr.tpmsmonitor.lowtirepressure events.

### Installation
1. Save [tpmsmonitor.js](https://raw.githubusercontent.com/jbeuree/ovms-extra-plugins/main/tpmsmonitor/tpmsmonitor.js) as /store/scripts/lib/tpmsmonitor.js
2. Add line to /store/scripts/ovmsmain.js:
   * tpmsmonitor = require("lib/tpmsmonitor");
3. Issue script reload or evaluate the require line
4. Install [TPMSMonitor.htm web](https://raw.githubusercontent.com/jbeuree/ovms-extra-plugins/main/tpmsmonitor/TPMSMonitor.htm) plugin, recommended setup:
   * Type: Page
   * Page: /usr/TPMSMonitor
   * Label: TPMSMonitor
   * Menu: Tools
   * Auth: Cookie

### Configuration

<img src="https://github.com/jbeuree/ovms-extra-plugins/raw/main/images/TPMSMonitor.png" width="600">

## Scheduled Climate Control
Start the climate control using a timer. Currently only has individual timers (not recurring)

### Installation
1. Save [schedule.js](https://raw.githubusercontent.com/jbeuree/ovms-extra-plugins/main/schedule/schedule.js) as /store/scripts/lib/schedule.js
2. Add line to /store/scripts/ovmsmain.js:
   * schedule = require("lib/schedule");
3. Issue script reload or evaluate the require line
4. Install [Schedule.htm web](https://raw.githubusercontent.com/jbeuree/ovms-extra-plugins/main/schedule/Schedule.htm) plugin, recommended setup:
   * Type: Page
   * Page: /usr/Schedule
   * Label: Schedule
   * Menu: Tools
   * Auth: Cookie

### Configuration

<img src="https://github.com/jbeuree/ovms-extra-plugins/raw/main/images/Schedule.png" width="600">
