/* global Module, MenuProvider */

/* Magic Mirror
 * Module: MMM-nutrislice-menu
 *
 * By Kurtis Blankenship
 * MIT Licensed.
 */

Module.register("MMM-nutrislice-menu", {
	defaults: {
		updateInterval: 3600000, //1 hour
		retryDelay: 60000, //1 minute
		nutrisliceEndpoint: "",
		itemLimit: 0,
		showPast: true,
		daysToShow: 5,
		retryLimit: 10,
		dayText: {
			"Day 1":"1-PE",
			"Day 2":"2-Art & Science",
			"Day 3":"3-PE & Henry Library",
			"Day 4":"4-Music & Deb Library"
		},
		showMenuText: true,
		weekdayShort: true
	},

	menuProvider: null,

	requiresVersion: "2.1.0", // Required version of MagicMirror
	start: function () {
		Log.info("Starting module: " + this.name);
		this.loaded = false;
		this.retryCnt = 0;
		this.menuProvider = MenuProvider.initialize(this);
		this.menuProvider.start();
		this.loaded = true;
		this.scheduleUpdate(1);
	},
	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update.
	 *  If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function (delay) {
		if (this.retryCnt <= this.config.retryLimit) {
			var nextLoad = this.config.updateInterval;
			if (typeof delay !== "undefined" && delay >= 0) {
				nextLoad = delay;
			}
			setTimeout(() => {
				 this.sendSocketNotification("FETCH_CURRENT_WEEK_MENU",this.menuProvider.getMenuData(true));
			 }, nextLoad);
		} else {
			this.updateDom();
		}
	},
	getDom: function () {
		const itemLimit = this.config.itemLimit;

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		wrapper.className = "dimmed small";

		var messageElement = document.createElement("div");
		if (this.config.nutrisliceEndpoint ===""){
			messageElement.innerHTML = "No <i>nutrislice Endpoint</i> set in config file";
			wrapper.appendChild(messageElement);
			return wrapper;
		}
		if (this.menuProvider.buildBaseEndpoint() == ""){
			messageElement.innerHTML = "Unreconized <i>nutrislice Endpoint</i> set in config file";
			wrapper.appendChild(messageElement);
			return wrapper;
		}
		if (!this.loaded) {
			messageElement.innerHTML = this.translate("LOADING");
			wrapper.appendChild(messageElement);
			return wrapper;
		}
		if (this.retryCnt > this.config.retryLimit) {
			messageElement.innerHTML = this.translate("NO_MORE_RETRY");
			wrapper.appendChild(messageElement);
			return wrapper;
		}
		if (!this.dataNotification) {
			messageElement.innerHTML = "No data";
			wrapper.appendChild(messageElement);
			return wrapper;
		}
		if (this.dataNotification) {
			var days = [...(this.dataNotification.days || [])];
			if (this.dataNotification2) {
				days = [...days, ...(this.dataNotification2.days || [])];
			}
			const mapOfDays = this.getMapOfDays(days);
			if ((mapOfDays || []).length > 0) {
				var tableElement = document.createElement("table");
				tableElement.className = this.config.tableClass;
				var tableRow = document.createElement("tr");
				mapOfDays.forEach(function (day) {
					var tableCell = document.createElement("td");
					var dayItem = document.createElement("u");
					if (day.activityDay) {
						dayItem.innerHTML = day.dayOfWeek + "-" + day.activityDay;
					} else {
						dayItem.innerHTML = day.dayOfWeek;
					}
					tableCell.appendChild(dayItem);
					tableCell.appendChild(document.createElement("br"));
					var itemCount = 0;
					day.foodList.forEach(function (item) {
						if (itemCount < itemLimit || itemLimit == 0) {
							var foodItem = document.createElement("span");
							foodItem.innerHTML = item;
							tableCell.appendChild(foodItem);
							tableCell.appendChild(document.createElement("br"));
							itemCount++;
						}
					});
					tableRow.appendChild(tableCell);
				});
				tableElement.appendChild(tableRow);
				wrapper.appendChild(tableElement);
			} else {
				messageElement.innerHTML = "No data";
				wrapper.appendChild(messageElement);
				return wrapper;
			}
		}

		return wrapper;
	},
	getWeekDay: function (dateString) {
		const date = new Date(dateString);
		if (this.config.weekdayShort) {
			var weekday = this.translate("WEEKDAYS_SHORT");
			return weekday[date.getDay()];
		} else {
			var weekday = this.translate("WEEKDAYS_LONG");
			return weekday[date.getDay()];
		}
	},
	getMapOfDays: function (days) {
		const mapOfDays = [];

		today = new Date();
		today.setDate(today.getDate() - 1);
		var showPast = this.config.showPast;
		for (key in Object.keys(days)) {
			var day = days[key];
			var date = new Date(day.date);
			if (day && day.date && (day.menu_items || []).length && (date >= today || showPast)) {
				var listOfFood = [];
				var dayObj = {dayOfWeek: this.getWeekDay(days[key].date)};
				for (itemKey in Object.keys(day.menu_items)) {
					var item = day.menu_items[itemKey];
					if (item.text) {
						if (item.text in this.config.dayText) {
							dayObj["activityDay"] = this.config.dayText[item.text];
						} else if (this.config.showMenuText) {
							listOfFood.push(item.text);
						}
					}
					if (item.food && item.food.name) {
						listOfFood.push(item.food.name);
					}
				}
				dayObj["foodList"] = listOfFood;
				mapOfDays.push(dayObj);
				if (Object.keys(mapOfDays).length >= this.config.daysToShow) {
					break;
				}
			}
		}
		return mapOfDays;
	},

	getScripts: function () {
		return ["menuProvider.js"];
	},

	getStyles: function () {
		return [
			"MMM-nutrislice-menu.css",
		];
	},

	getTranslations: function () {
		return {
			en: "translations/en.json",
			es: "translations/es.json"
		};
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification === "CURRENT_WEEK_MENU") {
			this.dataNotification = payload;
			this.retryCnt = 0;
			this.sendSocketNotification("FETCH_NEXT_WEEK_MENU", this.menuProvider.getMenuData(false));
		} else if (notification === "NEXT_WEEK_MENU") {
			this.dataNotification2 = payload;
			this.retryCnt = 0;
			this.updateDom();
			this.scheduleUpdate();
		} else if (notification === "STATUSERROR") {
			Log.error(this.name + ": fetch error – " + payload);
			this.retryCnt++;
			this.scheduleUpdate(this.config.retryDelay);
		}
	}
});