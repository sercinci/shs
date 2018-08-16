// Sercinci Hue System
// github.com/sercinci
// MIT License

(function(window){
    'use strict';

    var config = {
        shsScenes: {},
        shsRules: {}
    };
    var fetchParams = {}
    var listIndex = 0;
    var lightIndex = 0;

    var errors = {
        100: 'Bridge address or scene json parameter is missing!',
        101: 'Scene or lights parameter is missing. Lights parameter should be an array an contain at least one light id.',
        102: 'Scene parameter is missing or is not valid.'
    }

    /**
     * Utilities
     */
    function setConfig(a, p){
        if (a && p) {
            config.api = 'http://' + a + '/api';
            config.scenes = p;
            return true;
        } else {
            return false;
        }
    }

    function setCurrentScene(s, l){
        if (s && l && Array.isArray(l) && l.length > 0) {
            config.currentScene = s;
            for (var i = 0; i < config.scenesList[s].length; i++) {
                config.scenesList[s][i].scene.lights = config.scenesList[s][i].scene.lights.concat(l);
            }
            return true;
        } else {
            return false;
        }
    }

    function checkUser(){
        var cookie = document.cookie.match(new RegExp('shs' + '=([^;]+)'));
        if (cookie) {
            var content = JSON.parse(cookie[1]);
            config.username = content.username;
            config.userApi = config.api + '/' + config.username + '/';
            return Promise.resolve(getAllGroups());
        } else {
            return Promise.resolve(createUser());
        }
    }

    function registerCookie(){
        var content = {
            "username": config.username
        };
        var d = new Date();
        d.setTime(d.getTime() + 31536000000); // 1 year
        document.cookie = "shs=" + JSON.stringify(content) + ";path=/;expires=" + d.toUTCString();
        return Promise.resolve(getAllGroups());
    }

    function checkScene(){
        config.shsScenes[config.currentScene] = [];
        Object.keys(config.bridgeScenes).map(function(k){
            if (config.bridgeScenes[k].name.includes(config.currentScene)) {
                config.shsScenes[config.currentScene].push(k);
            }
        });
        if (config.shsScenes[config.currentScene].length > 0) { //posso controllare la lunghezza degli array sia uguale
            return Promise.resolve(getAllSensors());
        } else {
            listIndex = 0;
            return Promise.resolve(createScene());
        }
    }

    function checkRules(){
        config.shsRules[config.currentScene] = [];
        Object.keys(config.bridgeRules).map(function(k){
            if (config.bridgeRules[k].name.includes(config.currentScene)) {
                config.shsRules[config.currentScene].push(k);
            }
        });
        if (config.shsRules[config.currentScene].length > 0) {
            return Promise.resolve(saveTriggerState());
        } else {
            listIndex = 0;
            return Promise.resolve(createRule());
        }
    }

    function saveTriggerState(){
        return {
            loadedScene: config.currentScene,
            sceneTrigger: config.scenesList[config.currentScene][0].trigger,
            uploadedScenes: Object.keys(config.shsScenes), //lista shsScene volendo
        }
    }

    function playScene(scene){
        var state = scene;
        if (isNaN(state)) {
            if (config.scenesList[state]) {
                state = config.scenesList[state][0].trigger;
            } else {
                return Promise.reject('Error: the scene ' + state + ' is not in the list or is not valid.');
            }
        }
        return Promise.resolve(setSensorState(state));
    }

    function stopScene(){
        //check sensor state? (maybe not useful)
        return Promise.resolve(setSensorState(0));
    }

    function removeScenesAndRules(scene){
        config.currentScene = scene;
        listIndex = 0;
        return Promise.resolve(deleteRule());
    }

    /**
     * Callbacks
     */
    function saveUser(res){
        config.username = res[0].success.username;
        config.userApi = config.api + '/' + config.username + '/';
        return Promise.resolve(registerCookie());
    }

    function checkGroups(res){
        Object.keys(res).map(function(k){
            if (res[k].name == 'SHS') {
                config.group = k;
            }
        });
        if (config.group) {
            return Promise.resolve(getAllScenes());
        } else {
            return Promise.resolve(createGroup());
        }
    }

    function saveGroup(res){
        config.group = res[0].success.id;
        return Promise.resolve(getAllScenes());
    }

    function saveBridgeScenes(res){
        config.bridgeScenes = res;
        return Promise.resolve(getScenesJson());
    }

    function saveScenesJson(res){
        config.scenesList = res;
        return {
            collection_scenes: Object.keys(config.scenesList),
            bridge_scenes: Object.keys(config.bridgeScenes).map(function(k){return config.bridgeScenes[k].name;})
        }
    }

    function saveScene(res){
        config.scenesList[config.currentScene][listIndex]['sceneId'] = res[0].success.id;
        config.shsScenes[config.currentScene].push(res[0].success.id);
        lightIndex = 0;
        return Promise.resolve(setLightState());
    }

    function checkSceneIndex(res){
        listIndex++;
        if (config.scenesList[config.currentScene][listIndex]) {
            return Promise.resolve(createScene());
        } else {
            return Promise.resolve(getAllSensors());
        }
    }

    function checkSensors(res){
        Object.keys(res).map(function(k){
            if (res[k].uniqueid == 'SSercinci1') {
                config.sensor = k;
            }
        });
        if (config.sensor) {
            return Promise.resolve(getAllRules());
        } else {
            return Promise.resolve(createSensor());
        }
    }

    function saveSensor(res){
        config.sensor = res[0].success.id;
        return Promise.resolve(getAllRules());
    }

    function saveBridgeRules(res){
        config.bridgeRules = res;
        return Promise.resolve(checkRules());
    }

    function saveRule(res){
        config.shsRules[config.currentScene].push(res[0].success.id);
        listIndex++;
        if (config.scenesList[config.currentScene][listIndex]) {
            return Promise.resolve(createRule());
        } else {
            return Promise.resolve(saveTriggerState());
        }
    }

    function sensorState(res){
        return {
            loadedScene: config.currentScene,
            status: res[0].success['/sensors/' + config.sensor + '/state/status']
        };
    }

    function removeRule(res){
        config.shsRules[config.currentScene][listIndex] = null;
        listIndex++;
        if (config.shsRules[config.currentScene][listIndex]) {
            return Promise.resolve(deleteRule());
        } else {
            listIndex = 0;
            return Promise.resolve(deleteScene())
        }
    }

    function removeScene(res){
        config.shsScenes[config.currentScene][listIndex] = null;
        listIndex++;
        if (config.shsScenes[config.currentScene][listIndex]) {
            return Promise.resolve(deleteScene());
        } else {
            listIndex = 0;
            delete config.shsRules[config.currentScene];
            delete config.shsScenes[config.currentScene];
            return {
                removedScene: config.currentScene,
                sceneTrigger: config.scenesList[config.currentScene][0].trigger,
                uploadedScenes: Object.keys(config.shsScenes)
            }
        }
    }

    function checkLightIndex(res){
        lightIndex++;
        if (config.scenesList[config.currentScene][listIndex].scene.lights[lightIndex]) {
            return Promise.resolve(setLightState());
        } else {
            return Promise.resolve(checkSceneIndex(res))
        }
    }

    /**
     * API calls build
     */
    function createUser(){
        fetchParams = {
            url: config.api,
            method: 'POST',
            body: JSON.stringify({
                "devicetype": "sercinci_hue_system#" + navigator.appCodeName
            }),
            callback: saveUser
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function getAllGroups(){
        fetchParams = {
            url: config.userApi + 'groups',
            method: 'GET',
            body: null,
            callback: checkGroups
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function createGroup(){
        fetchParams = {
            url: config.userApi + 'griups',
            method: 'POST',
            body: JSON.stringify({
                "lights": [
                    "1",
                    "2",
                    "3"
                ],
                "name": "SHS"
            }),
            callback: saveGroup
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function getAllScenes(){
        fetchParams = {
            url: config.userApi + 'scenes',
            method: 'GET',
            body: null,
            callback: saveBridgeScenes
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function getScenesJson(){
        fetchParams = {
            url: config.scenes,
            method: 'GET',
            body: null,
            callback: saveScenesJson
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function createScene(){
        fetchParams = {
            url: config.userApi + 'scenes',
            method: 'POST',
            body: JSON.stringify(config.scenesList[config.currentScene][listIndex]['scene']),
            callback: saveScene
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function setLightState(){
        fetchParams = {
            url: config.userApi + 'scenes/' + config.scenesList[config.currentScene][listIndex]['sceneId'] + '/lightstates/' + config.scenesList[config.currentScene][listIndex].scene.lights[lightIndex],
            method: 'PUT',
            body: JSON.stringify(config.scenesList[config.currentScene][listIndex]['light']),
            callback: checkLightIndex
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function getAllSensors(){
        fetchParams = {
            url: config.userApi + 'sensors',
            method: 'GET',
            body: null,
            callback: checkSensors
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function createSensor(){
        fetchParams = {
            url: config.userApi + 'sensors',
            method: 'POST',
            body: JSON.stringify({
                "name": "Loop SHS",
                "modelid": "Sercinci_SS_Sensor",
                "swversion": "1.0",
                "type": "CLIPGenericStatus",
                "uniqueid": "SSercinci1",
                "manufacturername": "Sercinci",
                "state": {
                    "status": 0
                }
            }),
            callback: saveSensor
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function getAllRules(){
        fetchParams = {
            url: config.userApi + 'rules',
            method: 'GET',
            body: null,
            callback: saveBridgeRules
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function createRule(){
        fetchParams = {
            url: config.userApi + 'rules',
            method: 'POST',
            body: JSON.stringify(config.scenesList[config.currentScene][listIndex]['rule'])
                .replace(/_shs_sensor|_shs_group/gi, function(t){return config[t.slice(5)];})
                .replace(/_shs_scene/gi, config.shsScenes[config.currentScene][listIndex]),
            callback: saveRule
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function setSensorState(state){
        fetchParams = {
            url: config.userApi + 'sensors/' + config.sensor + '/state',
            method: 'PUT',
            body: JSON.stringify({"status": state}),
            callback: sensorState
        };
        return Promise.resolve(apiFetch(fetchParams));
    }

    function deleteRule(){
        fetchParams = {
            url: config.userApi + 'rules/' + config.shsRules[config.currentScene][listIndex],
            method: 'DELETE',
            body: null,
            callback: removeRule
        }
        return Promise.resolve(apiFetch(fetchParams));
    }

    function deleteScene(){
        fetchParams = {
            url: config.userApi + 'scenes/' + config.shsScenes[config.currentScene][listIndex],
            method: 'DELETE',
            body: null,
            callback: removeScene
        }
        return Promise.resolve(apiFetch(fetchParams));
    }

    /**
     * API fetch
     */
    function apiFetch(params){
        return new Promise(function(resolve, reject){
            fetch(params.url, {
                method: params.method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: params.body
            }).then(function(response) {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(response.statusText);
                }
            }).then(function(data){
                if (data[0] && data[0].error) {
                    throw new Error(data[0].error.description);
                } else {
                    resolve(params.callback(data));
                }
            }).catch(function(error) {
                reject(error);
            });
        });
    }

    /**
     * Library methods
     */
    function sercinciHueSystem(){
        var shs = {};

        shs.init = function(address, scenesPath){
            if (setConfig(address, scenesPath)) {
                return new Promise(function(resolve, reject){
                    resolve(checkUser());
                }); 
            } else {
                return Promise.reject(errors[100]);
            }
        }

        shs.load = function(scene, lights){
            if (setCurrentScene(scene, lights)) {
                return new Promise(function(resolve, reject){
                    resolve(checkScene());
                });
            } else {
                return Promise.reject(errors[101]);
            }
        }

        shs.play = function(scene){
            if (scene) {
                return new Promise(function(resolve, reject){
                    resolve(playScene(scene));
                });
            } else {
                return Promise.reject(errors[102]);
            }
        }

        shs.stop = function(){
            return new Promise(function(resolve, reject){
                resolve(stopScene());
            });
        }

        shs.remove = function(scene){
            if (scene) {
                return new Promise(function(resolve, reject){
                    resolve(removeScenesAndRules(scene));
                });
            } else {
                return Promise.reject(errors[102]);
            }
        }

        return shs;
    }

    if (typeof(window.shs) === 'undefined') {
        window.shs = sercinciHueSystem();
    }
})(window);