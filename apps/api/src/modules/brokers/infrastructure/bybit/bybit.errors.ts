import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Timeframe } from '../../../../common/enums.js';

export class BybitRequestTimeoutException extends ServiceUnavailableException {
  constructor(timeoutMs: number) {
    super(`Bybit request timed out after ${timeoutMs}ms`);
  }
}

export class BybitNetworkException extends ServiceUnavailableException {
  constructor(message: string) {
    super(`Bybit request failed: ${message}`);
  }
}

export class BybitHttpException extends BadGatewayException {
  constructor(status: number) {
    super(`Bybit HTTP error ${status}`);
  }
}

export class BybitApiException extends BadGatewayException {
  constructor(retCode: number, retMsg: string) {
    super(`Bybit API error ${retCode}: ${retMsg}`);
  }
}

export class BybitMalformedResponseException extends BadGatewayException {
  constructor(reason: string) {
    super(`Bybit returned a malformed response: ${reason}`);
  }
}

export class BybitUnsupportedTimeframeException extends BadRequestException {
  constructor(timeframe: Timeframe | string) {
    super(`Unsupported Bybit timeframe ${timeframe}`);
  }
}
