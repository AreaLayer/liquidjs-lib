/// <reference types="node" />
export declare const typeforce: any;
export declare function isPoint(p: Buffer | number | undefined | null): boolean;
export declare function UInt31(value: number): boolean;
export declare function BIP32Path(value: string): boolean;
export declare namespace BIP32Path {
    var toJSON: () => string;
}
export declare function Signer(obj: any): boolean;
export declare const ECPoint: any;
export declare const Network: any;
export interface IssuanceBlindingKeys {
    assetKey: Buffer;
    tokenKey?: Buffer;
}
export declare const Buffer256bit: any;
export declare const Hash160bit: any;
export declare const Hash256bit: any;
export declare const ConfidentialCommitment: any;
export declare const AssetBufferWithFlag: any;
export declare const AssetBuffer: any;
export declare const ConfidentialValue: any;
export declare const BufferOne: any;
export declare const Number: any;
export declare const Array: any;
export declare const Boolean: any;
export declare const String: any;
export declare const Buffer: any;
export declare const Hex: any;
export declare const Object: any;
export declare const maybe: any;
export declare const tuple: any;
export declare const UInt8: any;
export declare const UInt32: any;
export declare const Function: any;
export declare const BufferN: any;
export declare const Null: any;
export declare const oneOf: any;