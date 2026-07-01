declare module "starkbank-ecdsa" {
  export class PrivateKey {
    static fromPem(pem: string): PrivateKey;
  }
  export class PublicKey {
    static fromPem(pem: string): PublicKey;
  }
  export class Signature {
    static fromBase64(b64: string): Signature;
    toBase64(): string;
  }
  export const Ecdsa: {
    sign(message: string, privateKey: PrivateKey): Signature;
    verify(message: string, signature: Signature, publicKey: PublicKey): boolean;
  };
}
