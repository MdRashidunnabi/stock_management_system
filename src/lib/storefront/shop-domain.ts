export type DomainRecord = { type: string; host: string; value: string };

export type ShopDomainStatus = {
  domain: string;
  attached: boolean;
  verified: boolean;
  live: boolean;
  records: DomainRecord[];
  message: string;
};
