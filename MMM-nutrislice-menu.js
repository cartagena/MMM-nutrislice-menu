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
		ignoredFoodItems: [],
		weekdayShort: true,
		showCurrentDay: true
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
			const nextLoad = (typeof delay !== "undefined" && delay >= 0) ? delay : this.config.updateInterval;
			setTimeout(() => {
				this.sendSocketNotification("FETCH_CURRENT_WEEK_MENU", this.menuProvider.getMenuData(true));
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
		if (!this.currWeekDataNotification) {
			messageElement.innerHTML = "No data";
			wrapper.appendChild(messageElement);
			return wrapper;
		}
		if (this.currWeekDataNotification) {
			var days = [...(this.currWeekDataNotification.days || [])];
			if (this.nextWeekDataNotification) {
				days = [...days, ...(this.nextWeekDataNotification.days || [])];
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
		let date;
		if (dateString instanceof Date) {
			date = dateString;
		} else {
			const parts = dateString.split('-');
			date = new Date(parts[0], parts[1] - 1, parts[2]);
		}
		const weekday = this.translate(this.config.weekdayShort ? "WEEKDAYS_SHORT" : "WEEKDAYS_LONG");
		return weekday[(date.getDay() + 6) % 7];
	},
	getMapOfDays: function (days) {
		const mapOfDays = [];
		const showPast = this.config.showPast;
		const today = new Date();
		today.setDate(today.getDate() - 1);

		for (const day of days) {
			const [y, m, d] = day.date.split('-').map(Number);
			const currDate = new Date(y, m - 1, d);
			const dayOfWeek = currDate.getDay();
			if (dayOfWeek === 0 || dayOfWeek === 6) continue;

			if (day && day.date && (day.menu_items || []).length && (currDate >= today || showPast)) {
				const listOfFood = [];
				for (const item of day.menu_items) {
					if (item.food && item.food.name &&
						!this.config.ignoredFoodItems.includes(item.food.name)) {
						const sanitizedName = item.food.name.replace(/ *\([^)]*\) */g, "").trim();
						listOfFood.push({ name: sanitizedName, carbs: item.food.rounded_nutrition_info.g_carbs });
					}
				}
				mapOfDays.push({ dayOfWeek: this.getWeekDay(day.date), foodList: listOfFood });
				if (mapOfDays.length >= this.config.daysToShow) {
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
			this.currWeekDataNotification = payload;
			this.retryCnt = 0;
			this.sendSocketNotification("FETCH_NEXT_WEEK_MENU", this.menuProvider.getMenuData(false));
		} else if (notification === "NEXT_WEEK_MENU") {
			this.nextWeekDataNotification = payload;
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