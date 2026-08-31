class MenuProvider {
	constructor () {
		this.providerName = null;
		this.defaults = {};
		this.currentMenuObject = null;
		this.config = null;
		this.delegate = null;
	}

	init (config) {
		this.config = config;
		Log.info(`Menu provider: ${this.providerName} initialized.`);
	}

	setConfig (config) {
		this.config = config;
		Log.info(`Menu provider: ${this.providerName} config set.`, this.config);
	}

	start () {
		Log.info(`Menu provider: ${this.providerName} started.`);
	}

	buildBaseEndpoint () {
		const websiteUrl = this.config.nutrisliceEndpoint;
		const regExExtractUrl = /https:\/\/(.+)\.nutrislice\.com\/m\w*\/(.+)\/(.+)\//;
		const match = websiteUrl.match(regExExtractUrl);
		if ((match || []).length == 4) {
			return `https://${match[1]}.api.nutrislice.com/menu/api/weeks/school/${match[2]}/menu-type/${match[3]}`;
		}
		return "";
	}

	setEndpoint (date) {
		const baseUrl = this.buildBaseEndpoint();
		return `${baseUrl}/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/?format=json`;
	}

	getMenuData (currentWeek) {
		const currentDate = new Date();
		const nextWeekDate = new Date();
		nextWeekDate.setDate(currentDate.getDate() + 7);
		if (currentWeek) {
			const endpoint = this.setEndpoint(currentDate);
			console.log("FETCH_CURRENT_WEEK_MENU endpoint: " + endpoint);
			return endpoint;
		} else {
			const endpoint = this.setEndpoint(nextWeekDate);
			console.log("FETCH_NEXT_WEEK_MENU endpoint: " + endpoint);
			return endpoint;
		}
	}

	static initialize (delegate) {
		const provider = new MenuProvider();
		const config = Object.assign({}, provider.defaults, delegate.config);
		provider.delegate = delegate;
		provider.setConfig(config);
		return provider;
	}
}