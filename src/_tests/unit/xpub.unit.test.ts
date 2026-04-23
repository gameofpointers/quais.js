import assert from 'assert';

import { BIP44, HDNodeWallet, Mnemonic, QiHDWallet, QuaiHDWallet } from '../../wallet/index.js';

describe('HD wallet xPub APIs', function () {
    const phrase = 'test test test test test test test test test test test junk';

    function assertXpub(value: string): void {
        assert.ok(value.startsWith('xpub'), `expected xpub prefix, got ${value.slice(0, 4)}`);
        assert.ok(!value.startsWith('xprv'), 'xPub API must not return an xprv');
    }

    it('returns the neutered Quai HD wallet extended key', function () {
        const wallet = QuaiHDWallet.fromPhrase(phrase);
        const xpub = wallet.xPub();

        assertXpub(xpub);
        assert.equal(xpub, (wallet as any)._root.neuter().extendedKey);
    });

    it('returns the neutered Qi HD wallet extended key', function () {
        const wallet = QiHDWallet.fromPhrase(phrase);
        const xpub = wallet.xPub();

        assertXpub(xpub);
        assert.equal(xpub, (wallet as any)._root.neuter().extendedKey);
    });

    it('returns the neutered BIP44 root extended key', function () {
        const mnemonic = Mnemonic.fromPhrase(phrase);
        const root = HDNodeWallet.fromMnemonic(mnemonic, "m/44'/994'");
        const bip44 = new BIP44(root, 994);
        const xpub = bip44.xPub;

        assertXpub(xpub);
        assert.equal(xpub, root.neuter().extendedKey);
    });
});
