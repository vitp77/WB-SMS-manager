(function (){
  
  var nuberSMSById = {};
  
  defineVirtualDevice("sms_manager", {
    title: "SMS Manager",
    cells: {
      resend_to_telegramm: {
        type: "switch",
        value: true,
        title: "Пересылать SMS в Telegramm",
        order: 10
      },
      resended_SMS_timeStamp: {
        type: "text",
        value: "",
        title: "Последнее SMS",
        order: 20
      }
   }
  });
  
  function checkSms() {
    runShellCommand("mmcli --modem wbc --messaging-list-sms --output-json", {
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutput) {
        if (exitCode === 0) {
          // Добавление новых или обновление старых SMS
          JSON.parse(capturedOutput)["modem.messaging.sms"].forEach(function(item) {
            var subStrings = item.split("/");
            if (subStrings.length > 1) {
              var numberSMS = parseInt(subStrings[subStrings.length - 1], 10);
              addSMS(numberSMS);
            }
          });
        }
      }
    });
    setTimeout(checkSms, 60000);
  }
  
  function addSMS(numberSMS) {
    runShellCommand("mmcli --modem wbc --sms {} --output-json".format(numberSMS), {
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutputSMS) {
        if (exitCode === 0) {
          var Sms = JSON.parse(capturedOutputSMS);
          var phoneNumber = Sms["sms"]["content"]["number"];
          var textSMS = Sms["sms"]["content"]["text"];
          var timeStamp = Sms["sms"]["properties"]["timestamp"];
          var idSMS = timeStamp.replace(/s/g, "");
          idSMS = idSMS.replace(/-/g, "");
          idSMS = idSMS.replace(/:/g, "");
          idSMS = idSMS.replace(/\+/g, "");
          addContols(idSMS, phoneNumber, textSMS, timeStamp);
          nuberSMSById[idSMS] = numberSMS;
        }
      }
    });
  }
  
  function addContols(idSMS, phoneNumber, textSMS, timeStamp) {
    if (textSMS.length == 0) {return;}
    if (getDevice("sms_manager").isControlExists("SMS_{}_04_btn".format(idSMS))) {return;}
    log.debug("addContols: {}".format(idSMS));
    // Секунды
    var order = parseInt(idSMS.slice(-4, -2))
    // Минуты
    order += parseInt(idSMS.slice(-6, -4)) * 60
    // Часы
    order += parseInt(idSMS.slice(-8, -6)) * 3600
    // Дни
    order += parseInt(idSMS.slice(-11, -9)) * 24 * 3600
    // Месяцы
    order += parseInt(idSMS.slice(-13, -11)) * 31 * 24 * 3600
    // Год (1 разряд)
    order += parseInt(idSMS.slice(-14, -13)) * 12 * 31 * 24 * 3600
    // Очередность контролов в пределах SMS
    order *= 10 
    updateControl("SMS_{}_00_separator".format(idSMS),   "-----------------------------------------------------------------", "text", "", true, order);
    updateControl("SMS_{}_01_timeStamp".format(idSMS),   "Дата",    "text",       timeStamp, true, order + 1);
    updateControl("SMS_{}_02_phoneNumber".format(idSMS), "Номер",   "text",       phoneNumber, true, order + 2);
    updateControl("SMS_{}_03_textSMS".format(idSMS),     "Текст",   "text",       textSMS, true, order + 3);
    updateControl("SMS_{}_04_btn".format(idSMS),         "Удалить", "pushbutton", false, false, order + 4);
    // Обновление максимального штампа времени, если новый штамп больше максимального - сообщение новое
    if(dev["sms_manager/resended_SMS_timeStamp"] == null || dev["sms_manager/resended_SMS_timeStamp"] < timeStamp) {
      dev["sms_manager/resended_SMS_timeStamp"] = timeStamp
      if (dev["sms_manager/resend_to_telegramm"]){
        sendMsg("SMS с номера {}\n{}\n{}".format(phoneNumber, timeStamp, textSMS));
      }
    }
  }
  
  function updateControl(controlName, title, type, value, readonly, order) {
    if (!getDevice("sms_manager").isControlExists(controlName)) {
      getDevice("sms_manager").addControl(controlName, { title: title, type: type, value: value, readonly: readonly, order: order});
      if(type == "pushbutton") {
        defineRule("click_{}".format(controlName), {
            whenChanged: "sms_manager/{}".format(controlName),
            then: function (newValue, devName, ControlName) {
              deleteSMS(ControlName);
            }
        });
      }
    }
    else if (dev["sms_manager/{}".format(controlName)] != value) {
      getDevice("sms_manager").getControl(controlName).setValue({value: value, notify: false});
    }
  }
  
  // chatId и msgTopic - глобальные перменные,
  // заданные в telegram2wb-logic.js
  function sendMsg(text) {
    msg = {
      chatId: chatId,
      text: text
    }
    dev[msgTopic] = JSON.stringify(msg);
  }
  
  function deleteSMS(ControlName) {
    var idSMS = idSMSFromControlName(ControlName);
    log.debug("Delete SMS: {}".format(idSMS));
    runShellCommand("mmcli --modem wbc --messaging-delete-sms {}".format(nuberSMSById[idSMS]), {
      captureOutput: true,
      exitCallback: function (exitCode, capturedOutputSMS) {
        if (exitCode === 0) {
          deleteControls(idSMS);
        }
      }
    });
  }
  
  function idSMSFromControlName(ControlName) {
    var subStringControlName = ControlName.split("_");
    if (subStringControlName.length > 1) {
      return subStringControlName[1];
    }
    return NaN;
  }
  
  function deleteControls(idSMS) {
    log.debug("removeControl: {}".format(idSMS));
    deleteControl("SMS_{}_00_separator".format(idSMS));
    deleteControl("SMS_{}_01_timeStamp".format(idSMS));
    deleteControl("SMS_{}_02_phoneNumber".format(idSMS));
    deleteControl("SMS_{}_03_textSMS".format(idSMS));
    deleteControl("SMS_{}_04_btn".format(idSMS));
  }
  
  function deleteControl(ControlName) {
    getDevice("sms_manager").removeControl(ControlName);
    // Удалить контрол не достаточно, еще нужно почистить топики
    runShellCommand("mqtt-delete-retained '/devices/sms_manager/{}/#'".format(ControlName));
  }
  
  // Отключение вывода ворнингов модемменеджера
  runShellCommand("mmcli -G WARN");
  
  // Первый запуск обновления SMS при старте
  checkSms();
})();
