import {BidShareUpdated, AskCreated, AskRemoved, BidCreated, BidFinalized, BidRemoved} from '../types/Market/Market';
import {BigDecimal, BigInt, log, store} from "@graphprotocol/graph-ts";
import {Media, User, Ask, Bid} from "../types/schema";
import {createAsk, createBid, createInactiveAsk, createInactiveBid, findOrCreateUser, zeroAddress} from "./helpers";

const REMOVED = "Removed";
const FINALIZED = "Finalized";

export function handleBidShareUpdated(event: BidShareUpdated): void {
    let tokenId = event.params.tokenId.toString();
    let bidShares = event.params.bidShares;

    log.info(`Starting handler for BidShareUpdated Event for tokenId: {}, bidShares: {}`, [tokenId, bidShares.toString()]);

    let media = Media.load(tokenId);
    if (media == null) {
        log.error("Media is null for tokenId: {}", [tokenId]);
    }

    media.creatorBidShare = bidShares.creator.value;
    media.ownerBidShare = bidShares.owner.value;
    media.prevOwnerBidShare = bidShares.prevOwner.value;
    media.save();

    log.info(`Completed handler for BidShareUpdated Event for tokenId: {}, bidShares: {}`, [tokenId, bidShares.toString()]);
}

export function handleAskCreated(event: AskCreated): void {
    let tokenId = event.params.tokenId.toString();
    let onchainAsk = event.params.ask;

    log.info(`Starting handler for AskCreated Event for tokenId: {}, ask: {}`, [tokenId, onchainAsk.toString()]);

    let media = Media.load(tokenId);
    if (media == null) {
        log.error("Media is null for tokenId: {}", [tokenId]);
    }

    let askId = media.id.concat("-").concat(media.owner);
    createAsk(
        askId,
        onchainAsk.amount,
        onchainAsk.currency.toHexString(),
        onchainAsk.sellOnShare.value,
        media as Media,
        event.block.timestamp,
        event.block.number
    );

    log.info(`Completed handler for AskCreated Event for tokenId: {}, ask: {}`, [tokenId, onchainAsk.toString()]);

}

export function handleAskRemoved(event: AskRemoved): void {
    let tokenId = event.params.tokenId.toString();
    let onChainAsk = event.params.ask;
    let askId: string;

    log.info(`Starting handler for AskRemoved Event for tokenId: {}`, [tokenId]);

    let zero = BigInt.fromI32(0);
    // asks must be > 0 and evenly split by bidshares
    if (onChainAsk.amount.equals(zero)) {
        log.info(`AskRemoved Event has a 0 amount, returning early and not updating state`, []);
        askId = zeroAddress;
    } else {
        let media = Media.load(tokenId);
        if (media == null) {
            log.error("Media is null for tokenId: {}", [tokenId]);
        }
        

        askId = tokenId.concat("-").concat(media.owner);
        let ask = Ask.load(askId);
        if (ask == null) {
            log.error("Ask is null for askId: {}", [askId])
        }

        let inactiveAskId = event.transaction.hash.toHexString().concat("-").concat(event.transactionLogIndex.toString());
        createInactiveAsk(
            inactiveAskId,
            media as Media,
            REMOVED,
            ask.amount,
            ask.currency,
            ask.sellOnShare,
            ask.owner,
            event.block.timestamp,
            event.block.number
        );

        store.remove('Ask', askId);
    }

    log.info(`Completed handler for AskRemoved Event for tokenId: {}, askId: {}`, [tokenId, askId]);
}

export function handleBidCreated(event: BidCreated): void {
    let tokenId = event.params.tokenId.toString();
    let media = Media.load(tokenId);
    let bid = event.params.bid;

    log.info(`Starting handler for BidCreated Event for tokenId: {}, bid: {}`, [tokenId, bid.toString()]);

    if (media == null) {
        log.error("Media is null for tokenId: {}", [tokenId]);
    }

    let bidId = media.id.concat("-").concat(bid.bidder.toHexString());

    let bidder = findOrCreateUser(bid.bidder.toHexString())
    let recipient = findOrCreateUser(bid.recipient.toHexString());

    createBid(
        bidId,
        bid.amount,
        bid.currency.toHexString(),
        bid.sellOnShare.value,
        bidder,
        recipient,
        media as Media,
        event.block.timestamp,
        event.block.number
    )

    log.info(`Completed handler for BidCreated Event for tokenId: {}, bid: {}`, [tokenId, bid.toString()]);
}

export function handleBidRemoved(event: BidRemoved): void {
    let tokenId = event.params.tokenId.toString();
    let media = Media.load(tokenId);
    let onChainBid = event.params.bid;

    let bidId = tokenId.concat("-").concat(onChainBid.bidder.toHexString());

    log.info(`Starting handler for BidRemoved Event for tokenId: {}, bid: {}`, [tokenId, bidId]);

    if (media == null) {
        log.error("Media is null for tokenId: {}", [tokenId]);
    }

    let bid = Bid.load(bidId);
    if (bid == null){
        log.error("Bid is null for bidId: {}", [bidId]);
    }

    let inactiveBidId = event.transaction.hash.toHexString().concat("-").concat(event.transactionLogIndex.toString());
    let bidder = findOrCreateUser(onChainBid.bidder.toHexString())
    let recipient = findOrCreateUser(onChainBid.recipient.toHexString());


    // Create Inactive Bid
    createInactiveBid(
        inactiveBidId,
        REMOVED,
        media as Media,
        onChainBid.amount,
        onChainBid.currency.toHexString(),
        onChainBid.sellOnShare.value,
        bidder,
        recipient,
        event.block.timestamp,
        event.block.number
    );

    // Remove Bid
    store.remove('Bid', bidId);
    log.info(`Completed handler for BidRemoved Event for tokenId: {}, bid: {}`, [tokenId, bidId]);
}

export function handleBidFinalized(event: BidFinalized): void {
    let tokenId = event.params.tokenId.toString();
    let media = Media.load(tokenId);
    let onChainBid = event.params.bid;

    let bidId = tokenId.concat("-").concat(onChainBid.bidder.toHexString());
    log.info(`Starting handler for BidFinalized Event for tokenId: {}, bid: {}`, [tokenId, bidId]);

    if (media == null) {
        log.error("Media is null for tokenId: {}", [tokenId]);
    }

    let bid = Bid.load(bidId);
    if (bid == null){
        log.error("Bid is null for bidId: {}", [bidId]);
    }

    let inactiveBidId = event.transaction.hash.toHexString().concat("-").concat(event.transactionLogIndex.toString());

    let bidder = findOrCreateUser(onChainBid.bidder.toHexString())
    let recipient = findOrCreateUser(onChainBid.recipient.toHexString());

    // Create Inactive Bid
    createInactiveBid(
        inactiveBidId,
        FINALIZED,
        media as Media,
        onChainBid.amount,
        onChainBid.currency.toHexString(),
        onChainBid.sellOnShare.value,
        bidder,
        recipient,
        event.block.timestamp,
        event.block.number
    );

    // Remove Bid
    store.remove('Bid', bidId);
    log.info(`Completed handler for BidFinalized Event for tokenId: {}, bid: {}`, [tokenId, bidId]);
}
