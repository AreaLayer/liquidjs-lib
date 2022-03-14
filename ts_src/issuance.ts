import { BufferWriter } from './bufferutils';
import { satoshiToConfidentialValue } from './confidential';
import * as bcrypto from './crypto';
import { sha256Midstate } from './sha256d';
import { Input } from './transaction';

// one of the field of the IssuanceContract interface.
export interface IssuanceEntity {
  domain: string;
}

/**
 * Ricardian asset contract.
 */
export interface IssuanceContract {
  entity: IssuanceEntity;
  issuer_pubkey: string;
  name: string;
  precision: number;
  ticker: string;
  version: number;
}

/**
 * An object describing an output point of the blockchain.
 */
export interface Outpoint {
  txHash: Buffer;
  vout: number;
}

/**
 * An object describing an issuance. Can be attached to a Tx input.
 */
export interface Issuance {
  assetBlindingNonce: Buffer;
  assetEntropy: Buffer;
  assetAmount: Buffer;
  tokenAmount: Buffer;
}

/**
 * returns true if the issuance's token amount is not 0x00 or null buffer.
 * @param issuance issuance to test
 */
export function hasTokenAmount(issuance: Issuance): boolean {
  if (issuance.tokenAmount && issuance.tokenAmount.length > 1) return true;
  return false;
}

/**
 * Checks if a contract given as parameter is valid or not.
 * @param contract contract to validate.
 */
export function validateIssuanceContract(contract: IssuanceContract): boolean {
  const precisionIsValid = contract.precision >= 0 && contract.precision <= 8;
  return precisionIsValid;
}

/**
 * Returns the SHA256 value of the JSON encoded Issuance contract.
 * @param contract the contract to digest.
 */
export function hashContract(contract: IssuanceContract): Buffer {
  if (!validateIssuanceContract(contract))
    throw new Error('Invalid asset contract');

  const constractJSON = `{"entity":{"domain":"${
    contract.entity.domain
  }"},"issuer_pubkey":"${contract.issuer_pubkey}","name":"${
    contract.name
  }","precision":${contract.precision},"ticker":"${
    contract.ticker
  }","version":${contract.version}}`;
  return bcrypto
    .sha256(Buffer.from(constractJSON))
    .slice()
    .reverse();
}

/**
 * Returns an Issuance object for issuance transaction input.
 * @param assetAmount the number of asset to issue.
 * @param tokenAmount the number of token to issue.
 * @param precision the number of digit after the decimal point (8 for satoshi).
 * @param contract the asset ricarding contract of the issuance.
 */
export function newIssuance(
  assetAmount: number,
  tokenAmount: number,
  precision: number = 8,
  contract?: IssuanceContract,
): Issuance {
  if (assetAmount < 0) throw new Error('Invalid asset amount');
  if (tokenAmount < 0) throw new Error('Invalid token amount');
  if (precision < 0 || precision > 8) throw new Error('Invalid precision');
  let contractHash = Buffer.alloc(32);
  if (contract) {
    if (contract.precision !== precision)
      throw new Error('precision is not equal to the asset contract precision');
    contractHash = hashContract(contract);
  }
  const iss: Issuance = {
    assetAmount: toConfidentialAssetAmount(assetAmount, precision),
    tokenAmount: toConfidentialTokenAmount(tokenAmount, precision),
    assetBlindingNonce: Buffer.alloc(32),
    // in case of issuance, the asset entropy = the contract hash.
    assetEntropy: contractHash,
  };
  return iss;
}

export function isReissuance(issuance: Issuance): boolean {
  return !issuance.assetBlindingNonce.equals(Buffer.alloc(32));
}

/**
 * Generate the entropy.
 * @param outPoint the prevout point used to compute the entropy.
 * @param contractHash the 32 bytes contract hash.
 */
export function generateEntropy(
  outPoint: Outpoint,
  contractHash: Buffer = Buffer.alloc(32),
): Buffer {
  if (outPoint.txHash.length !== 32) {
    throw new Error('Invalid txHash length');
  }
  const tBuffer: Buffer = Buffer.allocUnsafe(36);
  const s: BufferWriter = new BufferWriter(tBuffer, 0);
  s.writeSlice(outPoint.txHash);
  s.writeInt32(outPoint.vout);
  const prevoutHash = bcrypto.hash256(s.buffer);
  const concatened = Buffer.concat([prevoutHash, contractHash]);
  return sha256Midstate(concatened);
}

/**
 * compute entropy from an input with issuance.
 * @param input reissuance or issuance input.
 */
export function issuanceEntropyFromInput(input: Input): Buffer {
  if (!input.issuance) throw new Error('input does not contain issuance data');
  return isReissuance(input.issuance)
    ? input.issuance.assetEntropy
    : generateEntropy(
        { txHash: input.hash, vout: input.index },
        input.issuance.assetEntropy,
      );
}

/**
 * calculate the asset tag from a given entropy.
 * @param entropy the entropy used to compute the asset tag.
 */
export function calculateAsset(entropy: Buffer): Buffer {
  if (entropy.length !== 32) throw new Error('Invalid entropy length');
  const kZero = Buffer.alloc(32);
  return sha256Midstate(Buffer.concat([entropy, kZero]));
}

/**
 * Compute the reissuance token.
 * @param entropy the entropy used to compute the reissuance token.
 * @param confidential true if confidential.
 */
export function calculateReissuanceToken(
  entropy: Buffer,
  confidential: boolean = false,
): Buffer {
  if (entropy.length !== 32) throw new Error('Invalid entropy length');
  return sha256Midstate(
    Buffer.concat([
      entropy,
      Buffer.of(getTokenFlag(confidential) + 1),
      Buffer.alloc(31),
    ]),
  );
}

function getTokenFlag(confidential: boolean): 1 | 0 {
  if (confidential) return 1;
  return 0;
}

/**
 * converts asset amount to confidential value.
 * @param assetAmount the asset amount.
 * @param precision the precision, 8 by default.
 */
export function toConfidentialAssetAmount(
  assetAmount: number,
  precision: number = 8,
): Buffer {
  const amount = Math.pow(10, precision) * assetAmount;
  return satoshiToConfidentialValue(amount);
}

/**
 * converts token amount to confidential value.
 * @param assetAmount the token amount.
 * @param precision the precision, 8 by default.
 */
export function toConfidentialTokenAmount(
  tokenAmount: number,
  precision: number = 8,
): Buffer {
  if (tokenAmount === 0) return Buffer.from('00', 'hex');
  return toConfidentialAssetAmount(tokenAmount, precision);
}