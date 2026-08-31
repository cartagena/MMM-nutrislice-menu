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
		var days = [...(this.currWeekDataNotification.days || [])];
		if (this.nextWeekDataNotification) {
			days = [...days, ...(this.nextWeekDataNotification.days || [])];
		}
		const mapOfDays = this.getMapOfDays(days);
		if (mapOfDays.length === 0) {
			messageElement.innerHTML = "No data";
			wrapper.appendChild(messageElement);
			return wrapper;
		}

		var contentContainer = document.createElement("div");
		contentContainer.className = "schoolmenu-container";

		if (this.config.showCurrentDay) {
			const now = new Date();
			const isPastNoon = now.getHours() >= 12;
			const targetDate = new Date();
			if (isPastNoon) {
				targetDate.setDate(targetDate.getDate() + 1);
				while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
					targetDate.setDate(targetDate.getDate() + 1);
				}
			}

			const targetLabel = this.getWeekDay(targetDate);
			let targetFood = mapOfDays.find(day => day.dayOfWeek === targetLabel);

			if (!targetFood) {
				const pad = n => String(n).padStart(2, '0');
				const targetDateStr = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}`;
				const rawDay = days.find(d => d.date === targetDateStr);
				if (rawDay) {
					const foodList = (rawDay.menu_items || [])
						.filter(item => item.food && item.food.name && !this.config.ignoredFoodItems.includes(item.food.name))
						.map(item => ({
							name: item.food.name.replace(/ *\([^)]*\) */g, "").trim(),
							carbs: item.food.rounded_nutrition_info?.g_carbs
						}));
					targetFood = { dayOfWeek: targetLabel, foodList };
				}
			}

			var currentDayElement = document.createElement("div");
			currentDayElement.className = "schoolmenu-carbsday schoolmenu-text";

			var foodCarbsHeader = document.createElement("h3");
			foodCarbsHeader.innerHTML = isPastNoon ? "Tomorrow's Carbs Count" : "Today's Carbs Count";
			currentDayElement.appendChild(foodCarbsHeader);

			if (targetFood) {
				for (const foodItem of targetFood.foodList) {
					var foodCarbsContainer = document.createElement("div");
					var foodSpan = document.createElement("span");
					foodSpan.innerHTML = foodItem.name;
					var carbsSpan = document.createElement("span");
					carbsSpan.innerHTML = `(${foodItem.carbs != null ? foodItem.carbs + "g" : "N/A"})`;
					carbsSpan.style.float = "right";
					foodCarbsContainer.appendChild(foodSpan);
					foodCarbsContainer.appendChild(carbsSpan);
					currentDayElement.appendChild(foodCarbsContainer);
				}
			}
			contentContainer.appendChild(currentDayElement);
		}

		var tableElement = document.createElement("table");
		tableElement.className = "schoolmenu-table";
		for (const currDay of mapOfDays) {
			var tableRow = document.createElement("tr");

			var dayCell = document.createElement("td");
			dayCell.className = "schoolmenu-text day";
			dayCell.innerHTML = currDay.dayOfWeek;
			tableRow.appendChild(dayCell);

			var foodCell = document.createElement("td");
			foodCell.className = "schoolmenu-text";
			var itemCount = 0;
			for (const foodItem of currDay.foodList) {
				if (itemLimit > 0 && itemCount >= itemLimit) break;
				var foodDiv = document.createElement("div");
				var foodSpan = document.createElement("span");
				foodSpan.innerHTML = foodItem.name;
				foodDiv.appendChild(foodSpan);
				foodCell.appendChild(foodDiv);
				itemCount++;
			}
			tableRow.appendChild(foodCell);
			tableElement.appendChild(tableRow);
		}
		contentContainer.appendChild(tableElement);
		return contentContainer;
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
						listOfFood.push({ name: sanitizedName, carbs: item.food.rounded_nutrition_info?.g_carbs });
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