import { ServiceUnavailableException } from '@nestjs/common';

export class FeatureDisabledException extends ServiceUnavailableException {
  constructor(feature: string) {
    super(`${feature} is currently disabled because persistent storage is not configured.`);
  }
}
