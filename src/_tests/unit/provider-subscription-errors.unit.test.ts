import assert from 'assert';

import { AbstractProvider, SocketProvider, SocketSubscriber, Subscriber, Zone } from '../../index.js';

class RejectingSubscriber implements Subscriber {
    startAttempts = 0;

    async start(): Promise<void> {
        this.startAttempts++;
        throw new Error('too many subscribers');
    }

    stop(): void {}
    pause(): void {}
    resume(): void {}
}

class SubscriptionTestProvider extends AbstractProvider {
    readonly subscriber = new RejectingSubscriber();

    override _getSubscriber(): Subscriber {
        return this.subscriber;
    }

    override async getBlockNumber(): Promise<number> {
        return 1;
    }

    override async getTransactionReceipt(): Promise<null> {
        return null;
    }
}

class ReconnectSubscriber implements Subscriber {
    startAttempts = 0;
    rejectStarts = false;

    async start(): Promise<void> {
        this.startAttempts++;
        if (this.rejectStarts) {
            throw new Error('too many subscribers');
        }
    }

    stop(): void {}
    pause(): void {}
    resume(): void {}
}

class ReconnectTestProvider extends AbstractProvider {
    readonly subscribers: ReconnectSubscriber[] = [];

    override _getSubscriber(): Subscriber {
        const subscriber = new ReconnectSubscriber();
        this.subscribers.push(subscriber);
        return subscriber;
    }
}

describe('Provider subscription errors', function () {
    it('propagates a rejected socket subscription request', async function () {
        const provider = {
            send: async () => {
                throw new Error('too many subscribers');
            },
            _register: () => undefined,
        } as unknown as SocketProvider;
        const subscriber = new SocketSubscriber(
            provider,
            ['accesses', '0x0010000000000000000000000000000000000000'],
            Zone.Cyprus1,
        );

        await assert.rejects(subscriber.start(), /too many subscribers/);
    });

    it('rejects on subscription failure and permits a later retry', async function () {
        const provider = new SubscriptionTestProvider();
        const event = {
            type: 'balance',
            address: '0x0010000000000000000000000000000000000000',
        };

        await assert.rejects(
            provider.on(event, () => undefined),
            /too many subscribers/,
        );
        assert.equal(await provider.listenerCount(event), 0);

        await assert.rejects(
            provider.on(event, () => undefined),
            /too many subscribers/,
        );
        assert.equal(provider.subscriber.startAttempts, 2);

        provider.destroy();
    });

    it('rejects waitForTransaction when its block subscription fails', async function () {
        const provider = new SubscriptionTestProvider();
        const hash = `0x00${'00'.repeat(31)}`;

        await assert.rejects(provider.waitForTransaction(hash, 1, 1000), /too many subscribers/);

        provider.destroy();
    });

    it('attempts every zone subscription during reconnect before rejecting', async function () {
        const provider = new ReconnectTestProvider();
        const firstEvent = {
            type: 'balance',
            address: '0x0010000000000000000000000000000000000000',
        };
        const secondEvent = {
            type: 'balance',
            address: '0x0020000000000000000000000000000000000000',
        };

        await provider.on(firstEvent, () => undefined);
        await provider.on(secondEvent, () => undefined);
        provider.subscribers[0].rejectStarts = true;

        await assert.rejects(provider.startZoneSubscriptions(Zone.Cyprus1), /too many subscribers/);
        assert.equal(provider.subscribers[0].startAttempts, 2);
        assert.equal(provider.subscribers[1].startAttempts, 2);

        provider.destroy();
    });
});
