const { fork } = require("child_process");
const { build } = require("./package");
const config = require(`./configs/${build}`);
const Discord = require("discord.js");
const request = require("superagent");

const SHARD_COUNT   = config.shards;
const CLIENT_TOKEN  = config.token;

class Shard extends fork {
    constructor(master, id) {
        super(`${__dirname}/source/client.js`, [], { env: { SHARD_ID: id, SHARD_COUNT, CLIENT_TOKEN, CLIENT_BUILD: build } });

        this.id = id;

        this.stats = {};

        this.master = master;

        this.on("message", message => {
            if (message.type === "stat" || message.type === "stats") {
                this.master.changeStats(this.id, message.data);
            } else if (message.type === "donors") {
                this.master.donorData = message.data;
                this.master.transmit(message.type, message.data);
            } else {
                this.master.transmit(message.type, message.data);
            }
        });
    }
}

new class {
    constructor() {
        this.shards = new Discord.Collection();
        this.stats = [];
        this.pendingRequests = new Discord.Collection();

        this.donorData = [];

        this.init();
    }

    create(id) {
        this.shards.set(id, new Shard(this, id));
    }

    changeStats(shard, data) {
        Object.keys(data).map(key => this.shards.get(shard).stats[key] = data[key]);
        this.relayStats();
    }

    relayStats() {
        const data = {};
        this.shards.forEach(shard => {
            Object.keys(shard.stats).forEach(key => {
                data[key] ? data[key] += shard.stats[key] : data[key] = shard.stats[key];
            });
        });
        this.transmit("stats", data);
    }

    transmit(type, data) {
        this.shards.forEach(shard => {
            shard.send({
                type,
                data
            });
        });
    }

    init() {
        for (let s = 0; s < SHARD_COUNT; s++) {
            setTimeout(this.create.bind(this), (9000 * s), s);
        }
    }
};
