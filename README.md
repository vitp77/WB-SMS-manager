# WB-SMS-manager
Скрипт виртуального устройства, читающее SMS сообщения в модеме и пересылающее их в Телеграмм.
Для работы в связке с Телеграмм используется скрипт telegram2wb (https://github.com/aadegtyarev/telegram2wb).
В теле демо виртуального устройства telegram2wb-logic.js нужно объявить глобальными переменные chatId и msgTopic:
global.__proto__.chatId = "ХХХХХХХХХ";
global.__proto__.msgTopic = "{}/{}".format(deviceName, bot.mqttMsg);
