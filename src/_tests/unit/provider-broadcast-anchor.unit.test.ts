import assert from 'assert';

import { AbstractProvider, PerformActionRequest } from '../../providers/abstract-provider.js';
import { Network } from '../../providers/network.js';
import { QuaiTransaction, QiTransaction } from '../../transaction/index.js';
import { Mnemonic, QiHDWallet } from '../../wallet/index.js';
import { Zone } from '../../constants/index.js';
import { loadTests } from '../utils.js';
import type { TestCaseQuaiTransaction, TestCaseQiTransaction } from '../types.js';

class BroadcastProvider extends AbstractProvider {
    readonly calls: Array<string> = [];

    constructor(private readonly expectedHash: string) {
        super(BigInt(1));
    }

    async _detectNetwork(): Promise<Network> {
        return Network.from(BigInt(1));
    }

    async _perform<T = any>(req: PerformActionRequest): Promise<T> {
        this.calls.push(req.method);

        if (req.method === 'getBlockNumber') {
            return 100 as T;
        }
        if (req.method === 'broadcastTransaction') {
            return this.expectedHash as T;
        }

        throw new Error(`Unexpected provider operation: ${req.method}`);
    }
}

describe('Provider broadcast replacement anchor', function () {
    it('captures the Quai replacement anchor before broadcasting', async function () {
        const test = loadTests<TestCaseQuaiTransaction>('quai-transaction')[0];
        const hash = QuaiTransaction.from(test.signed).hash as string;
        const provider = new BroadcastProvider(hash);

        const response = await provider.broadcastTransaction(Zone.Cyprus1, test.signed);

        assert.deepEqual(provider.calls, ['getBlockNumber', 'broadcastTransaction']);
        assert.equal((response as any).startBlock, 100);
    });

    it('does not fetch a replacement anchor for Qi broadcasts', async function () {
        const test = loadTests<TestCaseQiTransaction>('qi-transaction')[0];
        const wallet = QiHDWallet.fromMnemonic(Mnemonic.fromPhrase(test.mnemonic));
        for (const params of test.params) {
            wallet.getNextAddressSync(params.account, params.zone);
        }
        wallet.importOutpoints(test.outpoints);

        const transaction = new QiTransaction();
        transaction.chainId = test.transaction.chainId;
        transaction.txInputs = test.transaction.txInputs;
        transaction.txOutputs = test.transaction.txOutputs;
        const signed = await wallet.signTransaction(transaction);
        const hash = QiTransaction.from(signed).hash as string;
        const provider = new BroadcastProvider(hash);

        await provider.broadcastTransaction(Zone.Cyprus1, signed);

        assert.deepEqual(provider.calls, ['broadcastTransaction']);
    });
});
