import {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest,
} from "@phonepe-pg/pg-sdk-node";
import Logger from "../utils/logger.js";

let phonepeClient = null;

const getClient = () => {
  if (phonepeClient) {
    return phonepeClient;
  }

  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
  const clientVersion = parseInt(process.env.PHONEPE_CLIENT_VERSION || "1", 10);
  const env =
    process.env.PHONEPE_ENV === "Production" ? Env.PRODUCTION : Env.SANDBOX;

  if (!clientId || !clientSecret) {
    Logger.error(
      "PhonePe credentials missing. Set PHONEPE_CLIENT_ID and PHONEPE_CLIENT_SECRET in .env",
    );
    return null;
  }

  phonepeClient = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env,
  );

  Logger.info(
    `PhonePe client initialized in ${process.env.PHONEPE_ENV || "SANDBOX"} mode`,
  );
  return phonepeClient;
};

const initiatePayment = async (merchantOrderId, amountInPaise, redirectUrl) => {
  const client = getClient();
  if (!client) {
    throw new Error("PhonePe client not initialized. Check credentials.");
  }

  const request = StandardCheckoutPayRequest.builder()
    .merchantOrderId(merchantOrderId)
    .amount(amountInPaise)
    .redirectUrl(redirectUrl)
    .build();

  const response = await client.pay(request);
  Logger.info("PhonePe payment initiated", {
    merchantOrderId,
    amountInPaise,
  });
  return response;
};

const getPaymentStatus = async (merchantOrderId) => {
  const client = getClient();
  if (!client) {
    throw new Error("PhonePe client not initialized. Check credentials.");
  }

  const response = await client.getOrderStatus(merchantOrderId);
  Logger.info("PhonePe payment status fetched", {
    merchantOrderId,
    state: response?.state,
  });
  return response;
};

export default {
  getClient,
  initiatePayment,
  getPaymentStatus,
};
