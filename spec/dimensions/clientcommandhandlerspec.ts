import ClientCommandHandler from 'dimensions/clientcommandhandler';
import TerrariaServer from 'dimensions/terrariaserver';
import Client from 'dimensions/client';
import * as Net from 'net';
import RoutingServer from 'dimensions/routingserver';
import ClientPacketHandler from 'dimensions/clientpackethandler';
import TerrariaServerPacketHandler from 'dimensions/terrariaserverpackethandler';
import {ConfigOptions} from 'dimensions/configloader';
import Logger from 'dimensions/logger';
let Mitm = require('mitm');

describe("ClientCommandHandler", () => {
    let mitm;
    let config: ConfigOptions;
    let serverA: RoutingServer;
    let serverB: RoutingServer;
    let socket: Net.Socket;
    let serversDetails;
    let globalHandlers;
    let servers;
    let globalTracking;
    let client: Client;
    let server: TerrariaServer;

    let clientSocket: Net.Socket;
    let clientSocketDataHandlers: ((data: string) => void)[];

    beforeEach(() => {
        config = {
            socketTimeout: 0,
            currentTerrariaVersion: 0,
            fakeVersion: {
                enabled: false,
                terrariaVersion: 0
            },
            blacklist: {
                enabled: false,
                apiKey: ""
            },
            blockInvis: false,
            log: {
                clientBlocked: false,
                clientConnect: false,
                clientDisconnect: false,
                clientError: false,
                clientTimeouts: false,
                extensionLoad: false,
                outputToConsole: false,
                tServerConnect: false,
                tServerDisconnect: false,
                tServerError: false,
            },
            restApi: {
                enabled: false,
                port: 0
            }

        };
        mitm = Mitm();
        clientSocketDataHandlers = [];
        mitm.on("connection", (socket) => {
            clientSocket = socket;
            clientSocket.on("data", (data) => {
                for (let i = 0; i < clientSocketDataHandlers.length; i++) {
                    clientSocketDataHandlers[i](data.toString());
                }
            });
        });

        socket = Net.connect(22, "example.org");
        serverA = {
            name: "servera",
            serverIP: "localhost",
            serverPort: 7777
        };
        serverB = {
            name: "serverb",
            serverIP: "localhost",
            serverPort: 7778
        };

        serversDetails = {
            servera: {
                clientCount: 0,
                disabled: false,
                disabledTimeout: null,
                failedConnAttempts: 0
            },
            serverb: {
                clientCount: 0,
                disabled: false,
                disabledTimeout: null,
                failedConnAttempts: 0
            }
        };

        globalHandlers = {
            command: new ClientCommandHandler(),
            clientPacketHandler: new ClientPacketHandler(),
            terrariaServerPacketHandler: new TerrariaServerPacketHandler(),
            extensions: []
        };

        servers = {
            servera: serverA,
            serverb: serverB
        };

        globalTracking = {
            names: {}
        };

        client = new Client(0, socket, serverA, serversDetails, globalHandlers, servers, config, globalTracking, new Logger());
        server = new TerrariaServer(socket, client);
    });

    afterEach(() => {
        mitm.disable();
    });

    it("should not handle a non-existant command", () => {
        client.globalHandlers.command.parseCommand("/idonotexist");
        expect(client.server.name).toEqual(serverA.name);
    });

    /* TODO: test parseCommand */

    it("should properly convert a string into a command object", () => {
        let command = client.globalHandlers.command.parseCommand("/chips and gravy");
        expect(command.name).toBe("chips");
        expect(command.args.length).toBe(2);
        expect(command.args[0]).toBe("and");
        expect(command.args[1]).toBe("gravy");
    });

    describe("who", () => {
        it("should not handle the who command", () => {
            let command = client.globalHandlers.command.parseCommand("/who");
            let handled = client.globalHandlers.command.handle(command, client);
            expect(handled).toBe(false);
        });

        it("should send the user a user count", (done) => {
            clientSocketDataHandlers.push((data: string) => {
                expect(data).toContain("There are 0 players across all Dimensions");
                done();
            });
            client.globalHandlers.command.parseCommand("/who");
        });
    });

    describe("dimensionswitch", () => {
        it("should not switch to a non-existing dimension", () => {
            // Set to true to avoid callback waiting
            client.server.socket.destroyed = true;

            let command = client.globalHandlers.command.parseCommand("/asdasdas");
            let handled = client.globalHandlers.command.handle(command, client);
            expect(handled).toBe(false);
            expect(client.server.name).toBe(serverA.name);
        });

        it("should switch to an existing dimension", () => {
            // Set to true to avoid callback waiting
            client.server.socket.destroyed = true;

            let command = client.globalHandlers.command.parseCommand("/serverb");
            let handled = client.globalHandlers.command.handle(command, client);
            expect(handled).toBe(true);
            expect(client.server.name).toBe(serverB.name);
        });
    });
});