"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
let hap;
const mqtt_1 = __importDefault(require("mqtt"));
class DoorLock {
    constructor(log, config, api) {
        this.deviceOnOff = false;
        this.log = log;
        this.api = api;
        this.deviceName = config.name;
        this.manufacturer = config.manufacturer;
        this.model = config.model;
        this.serialNumber = config.serialNumber;
        this.mqttUrl = config.mqttUrl;
        this.mqttUser = config.mqttUser;
        this.mqttPass = config.mqttPass;
        this.topicStatus = config.topicStatus;
        this.topicCommand = config.topicCommand;
        this.onCommand = config.onCommand;
        this.offCommand = config.offCommand;
        this.onValue = config.onValue;
        this.offValue = config.offValue;
        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(hap.Characteristic.Model, this.model)
            .setCharacteristic(hap.Characteristic.SerialNumber, this.serialNumber);
        // Service Type
        this.deviceService = new hap.Service.LockMechanism(this.deviceName);
        this.deviceService.getCharacteristic(this.api.hap.Characteristic.LockTargetState)
            .on("get" /* GET */, this.getOnHandler.bind(this))
            .on("set" /* SET */, this.setOnHandler.bind(this));
        this.mqttOptions = {
            keepalive: 10,
            clientId: this.deviceName + "_" + (Math.random() * 10000).toFixed(0),
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            will: {
                topic: 'home/will',
                payload: this.deviceName,
                qos: 0,
                retain: false
            },
            username: this.mqttUser,
            password: this.mqttPass,
            rejectUnauthorized: false
        };
        // connect to MQTT broker
        this.mqttClient = mqtt_1.default.connect(this.mqttUrl, this.mqttOptions);
        this.setMqttEvent();
        this.log.info(this.deviceName + " plugin loaded.");
    }
    getOnHandler(callback) {
        callback(null, this.deviceOnOff);
    }
    setOnHandler(value, callback) {
        if (this.deviceOnOff != value) {
            let jsonCommand;
            if (value == true) {
                jsonCommand = this.onCommand;
            }
            else {
                jsonCommand = this.offCommand;
            }
            this.deviceOnOff = value;
            this.mqttClient.publish(this.topicCommand, jsonCommand);
            callback(null);
        }
    }
    setMqttEvent() {
        this.mqttClient.on("message", (topic, message) => {
            if (topic === this.topicStatus) {
                let jsonData = JSON.parse(message.toString());
                let deviceStatus = jsonData.DeviceStatus;
                let setValue = false;
                if (deviceStatus == this.onValue && this.deviceOnOff == false) {
                    this.deviceOnOff = true;
                    setValue = true;
                }
                if (deviceStatus == this.offValue && this.deviceOnOff == true) {
                    this.deviceOnOff = false;
                    setValue = true;
                }
                if (setValue == true) {
                    this.deviceService.updateCharacteristic(this.api.hap.Characteristic.LockCurrentState, this.deviceOnOff);
                    this.deviceService.updateCharacteristic(this.api.hap.Characteristic.LockTargetState, this.deviceOnOff);
                    setValue = false;
                    this.log.info("Set door to : " + this.deviceOnOff);
                }
            }
        });
        this.mqttClient.on("connect", () => {
            this.mqttClient.subscribe(this.topicStatus, (error) => {
                if (error) {
                    this.log.info("Failed to subscribe : " + this.topicStatus);
                }
            });
        });
        this.mqttClient.on("close", () => {
            this.log.info("MQTT connection closed.");
        });
    }
    /*
     * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
     * Typical this only ever happens at the pairing process.
     */
    identify() {
    }
    /*
     * This method is called directly after creation of this instance.
     * It should return all services which should be added to the accessory.
     */
    getServices() {
        return [
            this.informationService,
            this.deviceService
        ];
    }
}
module.exports = (api) => {
    hap = api.hap;
    api.registerAccessory("DoorLock", DoorLock);
};
//# sourceMappingURL=accessory.js.map