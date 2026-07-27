import assert from 'assert';

import { JsonRpcError, JsonRpcPayload, JsonRpcProvider, JsonRpcResult, VoidSigner } from '../../index.js';

class RecordingProvider extends JsonRpcProvider {
    sentPayloads: Array<JsonRpcPayload | Array<JsonRpcPayload>> = [];

    constructor() {
        super('http://localhost:8082/', 9n, {
            cacheTimeout: -1,
            staticNetwork: true,
            usePathing: false,
        });
    }

    override async _send(
        payload: JsonRpcPayload | Array<JsonRpcPayload>,
    ): Promise<Array<JsonRpcResult | JsonRpcError>> {
        this.sentPayloads.push(payload);

        const respond = (rpcRequest: JsonRpcPayload): JsonRpcResult => {
            let result: unknown;
            switch (rpcRequest.method) {
                case 'quai_getTransactionCount':
                    result = '0x1';
                    break;
                case 'quai_estimateGas':
                    result = '0x5208';
                    break;
                case 'quai_gasPrice':
                    result = '0x3b9aca00';
                    break;
                case 'quai_createAccessList':
                    result = { accessList: [] };
                    break;
                default:
                    throw new Error(`Unexpected RPC method: ${rpcRequest.method}`);
            }

            return {
                id: rpcRequest.id,
                result,
            };
        };

        return Array.isArray(payload) ? payload.map(respond) : [respond(payload)];
    }
}

describe('Signer transaction preparation batching', function () {
    it('batches nonce, gas, fee, and access-list requests without detecting the known network', async function () {
        const provider = new RecordingProvider();
        const signer = new VoidSigner('0x0010000000000000000000000000000000000000', provider);

        const transaction = await signer.populateQuaiTransaction({
            data: '0x1234',
            from: '0x0010000000000000000000000000000000000000',
            to: '0x0011000000000000000000000000000000000000',
            value: 1n,
        });

        assert.equal(provider.sentPayloads.length, 1);
        assert.ok(Array.isArray(provider.sentPayloads[0]));
        assert.deepEqual(
            (provider.sentPayloads[0] as Array<JsonRpcPayload>).map(({ method }) => method).sort(),
            ['quai_createAccessList', 'quai_estimateGas', 'quai_gasPrice', 'quai_getTransactionCount'].sort(),
        );
        assert.equal(transaction.nonce, 1);
        assert.equal(transaction.gasLimit, 21000n);
        assert.equal(transaction.gasPrice, 1000000000n);
        assert.deepEqual(transaction.accessList, []);

        provider.destroy();
    });
});
