export namespace main {
	
	export class InstallData {
	    appName: string;
	    projectName: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.projectName = source["projectName"];
	    }
	}
	export class TunnelData {
	    domain: string;
	    port: any;
	
	    static createFrom(source: any = {}) {
	        return new TunnelData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.domain = source["domain"];
	        this.port = source["port"];
	    }
	}

}

