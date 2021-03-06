// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import * as Styles from '../styles'
import * as Tabs from './tabs'
import * as Flow from '../util/flow'
import * as SettingsConstants from './settings'
import {isMobile} from './platform'
import {invert} from 'lodash-es'
import {type TypedState} from './reducer'
import HiddenString from '../util/hidden-string'
import {getPath, type RouteStateNode} from '../route-tree'

const balanceDeltaToString: {[key: RPCTypes.BalanceDelta]: $Keys<typeof RPCTypes.localBalanceDelta>} = invert(
  RPCTypes.localBalanceDelta
)
const statusSimplifiedToString: {
  [key: RPCTypes.PaymentStatus]: $Keys<typeof RPCTypes.localPaymentStatus>,
} = invert(RPCTypes.localPaymentStatus)
const partyTypeToString: {
  [key: RPCTypes.ParticipantType]: $Keys<typeof RPCTypes.localParticipantType>,
} = invert(RPCTypes.localParticipantType)

const sendRequestFormRouteKey = 'sendReceiveForm'
const chooseAssetFormRouteKey = 'chooseAssetForm'
const confirmFormRouteKey = 'confirmForm'
const sendRequestFormRoutes = [sendRequestFormRouteKey, confirmFormRouteKey]

const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeBuilding: I.RecordFactory<Types._Building> = I.Record({
  amount: '',
  bid: '',
  currency: 'XLM', // FIXME: Use default currency?
  from: Types.noAccountID,
  isRequest: false,
  publicMemo: new HiddenString(''),
  recipientType: 'keybaseUser',
  secretNote: new HiddenString(''),
  sendAssetChoices: null,
  to: '',
})

const makeBuiltPayment: I.RecordFactory<Types._BuiltPayment> = I.Record({
  amountAvailable: '',
  amountErrMsg: '',
  builtBanners: null,
  displayAmountFiat: '',
  displayAmountXLM: '',
  from: Types.noAccountID,
  publicMemoErrMsg: new HiddenString(''),
  readyToReview: false,
  readyToSend: 'spinning',
  reviewBanners: null,
  secretNoteErrMsg: new HiddenString(''),
  sendingIntentionXLM: false,
  toErrMsg: '',
  worthAmount: '',
  worthCurrency: '',
  worthDescription: '',
  worthInfo: '',
})

const makeBuiltRequest: I.RecordFactory<Types._BuiltRequest> = I.Record({
  amountErrMsg: '',
  builtBanners: null,
  displayAmountFiat: '',
  displayAmountXLM: '',
  readyToRequest: false,
  secretNoteErrMsg: new HiddenString(''),
  sendingIntentionXLM: false,
  toErrMsg: '',
  worthDescription: '',
  worthInfo: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  acceptedDisclaimer: false,
  acceptingDisclaimerDelay: false,
  accountMap: I.OrderedMap(),
  accountName: '',
  accountNameError: '',
  accountNameValidationState: 'none',
  assetsMap: I.Map(),
  buildCounter: 0,
  building: makeBuilding(),
  builtPayment: makeBuiltPayment(),
  builtRequest: makeBuiltRequest(),
  createNewAccountError: '',
  currencies: I.List(),
  currencyMap: I.Map(),
  exportedSecretKey: new HiddenString(''),
  exportedSecretKeyAccountID: Types.noAccountID,
  lastSentXLM: false,
  linkExistingAccountError: '',
  mobileOnlyMap: I.Map(),
  newPayments: I.Map(),
  paymentCursorMap: I.Map(),
  paymentLoadingMoreMap: I.Map(),
  paymentOldestUnreadMap: I.Map(),
  paymentsMap: I.Map(),
  reviewCounter: 0,
  reviewLastSeqno: null,
  secretKey: new HiddenString(''),
  secretKeyError: '',
  secretKeyMap: I.Map(),
  secretKeyValidationState: 'none',
  selectedAccount: Types.noAccountID,
  sentPaymentError: '',
  unreadPaymentsMap: I.Map(),
})

const buildPaymentResultToBuiltPayment = (b: RPCTypes.BuildPaymentResLocal) =>
  makeBuiltPayment({
    amountAvailable: b.amountAvailable,
    amountErrMsg: b.amountErrMsg,
    builtBanners: b.banners,
    displayAmountFiat: b.displayAmountFiat,
    displayAmountXLM: b.displayAmountXLM,
    from: Types.stringToAccountID(b.from),
    publicMemoErrMsg: new HiddenString(b.publicMemoErrMsg),
    readyToReview: b.readyToReview,
    secretNoteErrMsg: new HiddenString(b.secretNoteErrMsg),
    sendingIntentionXLM: b.sendingIntentionXLM,
    toErrMsg: b.toErrMsg,
    worthAmount: b.worthAmount,
    worthCurrency: b.worthCurrency,
    worthDescription: b.worthDescription,
    worthInfo: b.worthInfo,
  })

const buildRequestResultToBuiltRequest = (b: RPCTypes.BuildRequestResLocal) =>
  makeBuiltRequest({
    amountErrMsg: b.amountErrMsg,
    builtBanners: b.banners,
    displayAmountFiat: b.displayAmountFiat,
    displayAmountXLM: b.displayAmountXLM,
    readyToRequest: b.readyToRequest,
    secretNoteErrMsg: new HiddenString(b.secretNoteErrMsg),
    sendingIntentionXLM: b.sendingIntentionXLM,
    toErrMsg: b.toErrMsg,
    worthDescription: b.worthDescription,
    worthInfo: b.worthInfo,
  })

const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  accountID: Types.noAccountID,
  balanceDescription: '',
  isDefault: false,
  name: '',
})

const unknownAccount = makeAccount()

const accountResultToAccount = (w: RPCTypes.WalletAccountLocal) =>
  makeAccount({
    accountID: Types.stringToAccountID(w.accountID),
    balanceDescription: w.balanceDescription,
    isDefault: w.isDefault,
    name: w.name,
  })

const makeAssets: I.RecordFactory<Types._Assets> = I.Record({
  assetCode: '',
  availableToSendWorth: '',
  balanceAvailableToSend: '',
  balanceTotal: '',
  issuerAccountID: '',
  issuerName: '',
  issuerVerifiedDomain: '',
  name: '',
  reserves: I.List(),
  worth: '',
})

const assetsResultToAssets = (w: RPCTypes.AccountAssetLocal) =>
  makeAssets({
    assetCode: w.assetCode,
    availableToSendWorth: w.availableToSendWorth,
    balanceAvailableToSend: w.balanceAvailableToSend,
    balanceTotal: w.balanceTotal,
    issuerAccountID: w.issuerAccountID,
    issuerName: w.issuerName,
    issuerVerifiedDomain: w.issuerVerifiedDomain,
    name: w.name,
    reserves: I.List((w.reserves || []).map(makeReserve)),
    worth: w.worth,
  })

const makeCurrencies: I.RecordFactory<Types._LocalCurrency> = I.Record({
  code: '',
  description: '',
  name: '',
  symbol: '',
})

const currenciesResultToCurrencies = (w: RPCTypes.CurrencyLocal) =>
  makeCurrencies({
    code: w.code,
    description: w.description,
    name: w.name,
    symbol: w.symbol,
  })

const _defaultPaymentCommon = {
  amountDescription: '',
  delta: 'none',
  error: '',
  id: Types.noPaymentID,
  issuerAccountID: null,
  issuerDescription: '',
  note: new HiddenString(''),
  noteErr: new HiddenString(''),
  showCancel: false,
  source: '',
  sourceAccountID: '',
  sourceType: '',
  statusDescription: '',
  statusDetail: '',
  statusSimplified: 'none',
  target: '',
  targetAccountID: '',
  targetType: '',
  time: null,
  worth: '',
  worthAtSendTime: '',
}

const _defaultPaymentResult = {
  ..._defaultPaymentCommon,
  section: 'none',
  unread: false,
}

const _defaultPaymentDetail = {
  ..._defaultPaymentCommon,
  externalTxURL: '',
  publicMemo: new HiddenString(''),
  publicMemoType: '',
  txID: '',
}

const _defaultPayment = {
  ..._defaultPaymentResult,
  ..._defaultPaymentDetail,
}

const makePaymentResult: I.RecordFactory<Types._PaymentResult> = I.Record(_defaultPaymentResult)

const makePaymentDetail: I.RecordFactory<Types._PaymentDetail> = I.Record(_defaultPaymentDetail)

const makePayment: I.RecordFactory<Types._Payment> = I.Record(_defaultPayment)

const makeCurrency: I.RecordFactory<Types._LocalCurrency> = I.Record({
  code: '',
  description: '',
  name: '',
  symbol: '',
})

const partyToDescription = (type, username, assertion, name, id): string => {
  switch (type) {
    case 'keybase':
      return username
    case 'sbs':
      return assertion
    case 'ownaccount':
      return name
    default:
      return id
  }
}

const rpcPaymentResultToPaymentResult = (w: RPCTypes.PaymentOrErrorLocal, section: Types.PaymentSection) => {
  if (!w) {
    return makePaymentResult({error: 'No payments returned'})
  }
  if (!w.payment) {
    return makePaymentResult({error: w.err})
  }
  const unread = w.payment.unread
  return makePaymentResult({
    ...rpcPaymentToPaymentCommon(w.payment),
    section,
    unread,
  })
}

const rpcPaymentDetailToPaymentDetail = (p: RPCTypes.PaymentDetailsLocal) =>
  makePaymentDetail({
    ...rpcPaymentToPaymentCommon(p),
    externalTxURL: p.externalTxURL,
    publicMemo: new HiddenString(p.publicNote),
    publicMemoType: p.publicNoteType,
    txID: p.txID,
  })

const rpcPaymentToPaymentCommon = (p: RPCTypes.PaymentLocal | RPCTypes.PaymentDetailsLocal) => {
  const sourceType = partyTypeToString[p.fromType]
  const source = partyToDescription(sourceType, p.fromUsername, '', p.fromAccountName, p.fromAccountID)
  let targetType = partyTypeToString[p.toType]
  let target = partyToDescription(
    targetType,
    p.toUsername,
    p.toAssertion,
    p.toAccountName,
    p.toAccountID || ''
  )
  if (p.statusDescription === 'canceled') {
    // Canceled relay. Similar presentation to a cancelable relay. Service
    // transformed this to an account self-transfer, let's preserve the original
    // target so we can show it.
    target = p.originalToAssertion
    targetType = 'keybase'
  }
  const serviceStatusSimplfied = statusSimplifiedToString[p.statusSimplified]
  return {
    amountDescription: p.amountDescription,
    delta: balanceDeltaToString[p.delta],
    error: '',
    id: Types.rpcPaymentIDToPaymentID(p.id),
    issuerAccountID: p.issuerAccountID ? Types.stringToAccountID(p.issuerAccountID) : null,
    issuerDescription: p.issuerDescription,
    note: new HiddenString(p.note),
    noteErr: new HiddenString(p.noteErr),
    showCancel: p.showCancel,
    source,
    sourceAccountID: p.fromAccountID,
    sourceType,
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    statusSimplified: serviceStatusSimplfied,
    target,
    targetAccountID: p.toAccountID,
    targetType,
    time: p.time,
    worth: p.worth,
    worthAtSendTime: p.worthAtSendTime,
  }
}

const makeAssetDescription: I.RecordFactory<Types._AssetDescription> = I.Record({
  code: '',
  issuerAccountID: Types.noAccountID,
  issuerName: '',
  issuerVerifiedDomain: '',
})

const bannerLevelToBackground = (level: string) => {
  switch (level) {
    case 'info':
      return 'Announcements'
    case 'error':
      return 'HighRisk'
    default:
      console.warn('Unexpected banner level', level)
      return 'Information'
  }
}

const partyTypeToCounterpartyType = (t: string): Types.CounterpartyType => {
  switch (t) {
    case 'ownaccount':
      return 'otherAccount'
    case 'sbs':
    case 'keybase':
      return 'keybaseUser'
    case 'stellar':
      return 'stellarPublicKey'
    default:
      // TODO: Have better typing here so we don't need this.
      return 'stellarPublicKey'
  }
}

const paymentToYourInfoAndCounterparty = (
  p: Types.Payment
): {
  yourAccountName: string,
  yourRole: Types.Role,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
} => {
  switch (p.delta) {
    case 'none':
      // Need to guard check that sourceType is non-empty to handle the
      // case when p is the empty value.
      if (p.sourceType && p.sourceType !== 'ownaccount') {
        throw new Error(`Unexpected sourceType ${p.sourceType} with delta=none`)
      }
      if (p.targetType && p.targetType !== 'ownaccount') {
        throw new Error(`Unexpected targetType ${p.targetType} with delta=none`)
      }
      if (p.source !== p.target) {
        throw new Error(`source=${p.source} != target=${p.target} with delta=none`)
      }
      return {
        counterparty: p.source,
        counterpartyType: 'otherAccount',
        yourAccountName: p.source,
        yourRole: 'senderAndReceiver',
      }

    case 'increase':
      return {
        counterparty: p.source,
        counterpartyType: partyTypeToCounterpartyType(p.sourceType),
        yourAccountName: p.sourceType === 'ownaccount' ? p.target : '',
        yourRole: 'receiverOnly',
      }
    case 'decrease':
      return {
        counterparty: p.target,
        counterpartyType: partyTypeToCounterpartyType(p.targetType),
        yourAccountName: p.sourceType === 'ownaccount' ? p.source : '',
        yourRole: 'senderOnly',
      }

    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(p.delta)
      throw new Error(`Unexpected delta ${p.delta}`)
  }
}

const updatePaymentDetail = (
  map: I.Map<Types.PaymentID, Types.Payment>,
  paymentDetail: Types.PaymentDetail
): I.Map<Types.PaymentID, Types.Payment> => {
  return map.update(paymentDetail.id, (oldPayment = makePayment()) => oldPayment.merge(paymentDetail))
}

const updatePaymentsReceived = (
  map: I.Map<Types.PaymentID, Types.Payment>,
  paymentResults: Array<Types.PaymentResult>
): I.Map<Types.PaymentID, Types.Payment> => {
  return map.withMutations(mapMutable =>
    paymentResults.forEach(paymentResult =>
      mapMutable.update(paymentResult.id, (oldPayment = makePayment()) => oldPayment.merge(paymentResult))
    )
  )
}

const acceptDisclaimerWaitingKey = 'wallets:acceptDisclaimer'
const changeAccountNameWaitingKey = 'wallets:changeAccountName'
const createNewAccountWaitingKey = 'wallets:createNewAccount'
const changeDisplayCurrencyWaitingKey = 'wallets:changeDisplayCurrency'
const getDisplayCurrencyWaitingKey = (id: Types.AccountID) => `wallets:getDisplayCurrency:${id}`
const linkExistingWaitingKey = 'wallets:linkExisting'
const loadEverythingWaitingKey = 'wallets:loadEverything'
const buildPaymentWaitingKey = 'wallets:buildPayment'
const sendPaymentWaitingKey = 'wallets:stellarSend'
const requestPaymentWaitingKey = 'wallets:requestPayment'
const setAccountAsDefaultWaitingKey = 'wallets:setAccountAsDefault'
const deleteAccountWaitingKey = 'wallets:deleteAccount'
const searchKey = 'walletSearch'
const loadAccountWaitingKey = (id: Types.AccountID) => `wallets:loadAccount:${id}`
const cancelPaymentWaitingKey = (id: Types.PaymentID) =>
  `wallets:cancelPayment:${Types.paymentIDToString(id)}`
const validateAccountNameWaitingKey = 'wallets:validateAccountName'
const validateSecretKeyWaitingKey = 'wallets:validateSecretKey'
const getRequestDetailsWaitingKey = (id: Types.PaymentID) =>
  `wallets:requestDetailsWaitingKey:${Types.paymentIDToString(id)}`

const getAccountIDs = (state: TypedState) => state.wallets.accountMap.keySeq().toList()

const getAccounts = (state: TypedState) => state.wallets.accountMap.valueSeq().toList()

const getSelectedAccount = (state: TypedState) => state.wallets.selectedAccount

const getDisplayCurrencies = (state: TypedState) => state.wallets.currencies

const getDisplayCurrency = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.currencyMap.get(accountID, makeCurrency())

const getPayments = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentsMap.get(accountID, null)

const getOldestUnread = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentOldestUnreadMap.get(accountID, Types.noPaymentID)

const getPayment = (state: TypedState, accountID: Types.AccountID, paymentID: Types.PaymentID) =>
  state.wallets.paymentsMap.get(accountID, I.Map()).get(paymentID, makePayment())

const getAccount = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.accountMap.get(accountID, unknownAccount)

const getDefaultAccountID = (state: TypedState) => {
  const defaultAccount = state.wallets.accountMap.find(a => a.isDefault)
  return defaultAccount ? defaultAccount.accountID : null
}

const getAssets = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.assetsMap.get(accountID, I.List())

const getFederatedAddress = (state: TypedState, accountID: Types.AccountID) => {
  const account = state.wallets.accountMap.get(accountID, unknownAccount)
  const {username} = state.config
  return username && account.isDefault ? `${username}*keybase.io` : ''
}

const getSecretKey = (state: TypedState, accountID: Types.AccountID) =>
  accountID === state.wallets.exportedSecretKeyAccountID
    ? state.wallets.exportedSecretKey
    : new HiddenString('')

const shortenAccountID = (id: Types.AccountID) => id.substring(0, 8) + '...' + id.substring(48)

const isAccountLoaded = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.accountMap.has(accountID)

const isFederatedAddress = (address: ?string) => (address ? address.includes('*') : false)

const isPaymentUnread = (state: TypedState, accountID: Types.AccountID, paymentID: Types.PaymentID) => {
  const newPaymentsForAccount = state.wallets.newPayments.get(accountID, false)
  return newPaymentsForAccount && newPaymentsForAccount.has(paymentID)
}

const getCurrencyAndSymbol = (state: TypedState, code: string) => {
  if (!state.wallets.currencies || !code) {
    return ''
  }
  const currency = state.wallets.currencies.find(c => c.code === code)
  return currency ? currency.description : code
}

const getAcceptedDisclaimer = (state: TypedState) => state.wallets.acceptedDisclaimer

const balanceChangeColor = (delta: Types.PaymentDelta, status: Types.StatusSimplified) => {
  let balanceChangeColor = Styles.globalColors.black_75
  if (delta !== 'none') {
    balanceChangeColor = delta === 'increase' ? Styles.globalColors.green : Styles.globalColors.black_75
  }
  if (status !== 'completed') {
    balanceChangeColor = Styles.globalColors.black_20
  }
  return balanceChangeColor
}

const balanceChangeSign = (delta: Types.PaymentDelta, balanceChange: string = '') => {
  let sign = ''
  if (delta !== 'none') {
    sign = delta === 'increase' ? '+' : '-'
  }
  return sign + balanceChange
}

const rootWalletTab = isMobile ? Tabs.settingsTab : Tabs.walletsTab // tab for wallets
const rootWalletPath = [rootWalletTab, ...(isMobile ? [SettingsConstants.walletsTab] : [])] // path to wallets
const walletPath = isMobile ? rootWalletPath : [...rootWalletPath, 'wallet'] // path to wallet

const walletPathList = I.List(walletPath)
const isLookingAtWallet = (routeState: ?RouteStateNode) => {
  const path = getPath(routeState, [rootWalletTab])
  return path.equals(walletPathList)
}

export {
  acceptDisclaimerWaitingKey,
  accountResultToAccount,
  assetsResultToAssets,
  bannerLevelToBackground,
  balanceChangeColor,
  balanceChangeSign,
  buildPaymentWaitingKey,
  cancelPaymentWaitingKey,
  changeDisplayCurrencyWaitingKey,
  currenciesResultToCurrencies,
  changeAccountNameWaitingKey,
  balanceDeltaToString,
  buildPaymentResultToBuiltPayment,
  buildRequestResultToBuiltRequest,
  chooseAssetFormRouteKey,
  confirmFormRouteKey,
  createNewAccountWaitingKey,
  deleteAccountWaitingKey,
  getAcceptedDisclaimer,
  getAccountIDs,
  getAccounts,
  getAccount,
  getAssets,
  getCurrencyAndSymbol,
  getDisplayCurrencies,
  getDisplayCurrency,
  getDisplayCurrencyWaitingKey,
  getDefaultAccountID,
  getFederatedAddress,
  getPayment,
  getPayments,
  getOldestUnread,
  getRequestDetailsWaitingKey,
  getSecretKey,
  getSelectedAccount,
  isAccountLoaded,
  isFederatedAddress,
  isLookingAtWallet,
  isPaymentUnread,
  linkExistingWaitingKey,
  loadAccountWaitingKey,
  loadEverythingWaitingKey,
  makeAccount,
  makeAssetDescription,
  makeAssets,
  makeCurrencies,
  makeCurrency,
  makeBuilding,
  makeBuiltPayment,
  makeBuiltRequest,
  makePaymentResult,
  makePaymentDetail,
  makePayment,
  makeReserve,
  makeState,
  paymentToYourInfoAndCounterparty,
  requestPaymentWaitingKey,
  rootWalletPath,
  rootWalletTab,
  rpcPaymentDetailToPaymentDetail,
  rpcPaymentResultToPaymentResult,
  sendPaymentWaitingKey,
  sendRequestFormRouteKey,
  sendRequestFormRoutes,
  setAccountAsDefaultWaitingKey,
  searchKey,
  shortenAccountID,
  statusSimplifiedToString,
  unknownAccount,
  updatePaymentDetail,
  updatePaymentsReceived,
  validateAccountNameWaitingKey,
  validateSecretKeyWaitingKey,
  walletPath,
}
