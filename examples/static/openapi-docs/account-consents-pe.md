##### Создание ресурса согласия на доступ к счету с предоставлением всех разрешения

###### Пример создание ресурса Согласия на доступ к счету

```
POST /account-consents HTTP/1.1
Authorization: Bearer 2YotnFZFEjr1zCsicMWpAA
x-fapi-auth-date: Sun, 10 Sep 2024 19:43:31 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
Accept: application/json
```

```json
{
  "Data": {
    "permissions": [
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadProducts",
      "ReadTransactionsCredits",
      "ReadTransactionsDebits",
      "ReadTransactionsDetail",
      "ReadPaymentCards"
    ],
    "expirationDateTime": "2024-05-02T00:00:00+00:00",
    "transactionFromDateTime": "2024-05-03T00:00:00+00:00",
    "transactionToDateTime": "2024-12-03T00:00:00+00:00"
  }
}
```

###### Пример ответа на запрос создания Согласия на доступ к счету

```
HTTP/1.1 201 Created
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```

```json
{
  "Data": {
    "consentId": "urn-anybank-intent-99880",
    "status": "AwaitingAuthorisation",
    "statusUpdateDateTime": "2024-05-02T00:00:00+00:00",
    "creationDateTime": "2024-05-02T00:00:00+00:00",
    "permissions": [
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadProducts",
      "ReadTransactionsCredits",
      "ReadTransactionsDebits",
      "ReadTransactionsDetail",
      "ReadPaymentCards"
    ],
    "expirationDateTime": "2024-08-02T00:00:00+00:00",
    "transactionFromDateTime": "2024-05-03T00:00:00+00:00",
    "transactionToDateTime": "2024-12-03T00:00:00+00:00"
  },
  "Links": {
    "self": "https://api.anybank.ru/open-banking/v2.0/aisp/account-consents/urn-anybank-intent-99880"
  },
  "Meta": {
    "totalPages": 1
  }
}
```

##### Статус - AwaitingAuthorisation

В данном примере запрос был выполнен **до**  того, когда ресурс Согласия был авторизован.

###### Запрос получение ресурса согласия

```
GET /account-consents/urn-anybank-intent-99880 HTTP/1.1
Authorization: Bearer 2YotnFZFEjr1zCsicMWpAA
x-fapi-auth-date: Sun, 10 Sep 2024 19:43:31 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Accept: application/json
```

###### Ответ на получение ресурса согласия

```
HTTP/1.1 200 OK
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```
```json
{
  "Data": {
    "consentId": "urn-anybank-intent-99880",
    "status": "AwaitingAuthorisation",
   "statusReason": {
    "statusReasonDescription":"Waiting for completion of consent authorisation to be completed by user",
    "statusUpdateDateTime": "2024-05-02T00:00:00+00:00",
    "creationDateTime": "2024-05-02T00:00:00+00:00",
    "permissions": [
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadProducts",
      "ReadTransactionsCredits",
      "ReadTransactionsDebits",
      "ReadTransactionsDetail",
      "ReadPaymentCards"
    ],
    "expirationDateTime": "2024-08-02T00:00:00+00:00",
    "transactionFromDateTime": "2024-05-03T00:00:00+00:00",
    "transactionToDateTime": "2024-12-03T00:00:00+00:00"
  },
  "Links": {
    "self": "https://api.anybank.ru/open-banking/v2.0/aisp/account-consents/urn-anybank-intent-99880"
  },
  "Meta": {
    "totalPages": 1
  }
}
```

##### Статус - Authorised

В данном примере запрос был выполнен **после**  того, когда ресурс Согласия был авторизован.

###### Запрос получение ресурса согласия

```
GET /account-consents/urn-anybank-intent-99880 HTTP/1.1
Authorization: Bearer 2YotnFZFEjr1zCsicMWpAA
x-fapi-auth-date: Sun, 10 Sep 2024 19:43:31 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Accept: application/json
```

###### Ответ на получение ресурса согласия

```
HTTP/1.1 200 OK
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```
```json
{
  "Data": {
    "consentId": "urn-anybank-intent-99880",
    "status": "Authorised",
    "statusUpdateDateTime": "2024-05-02T00:05:00+00:00",
    "creationDateTime": "2024-05-02T00:00:00+00:00",
    "permissions": [
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadProducts",
      "ReadTransactionsCredits",
      "ReadTransactionsDebits",
      "ReadTransactionsDetail",
      "ReadPaymentCards"
    ],
    "expirationDateTime": "2024-08-02T00:00:00+00:00",
    "transactionFromDateTime": "2024-05-03T00:00:00+00:00",
    "transactionToDateTime": "2024-12-03T00:00:00+00:00"
  },
  "Links": {
    "self": "https://api.anybank.ru/open-banking/v2.0/aisp/account-consents/urn-anybank-intent-99880"
  },
  "Meta": {
    "totalPages": 1
  }
}
```

##### Статус - Rejected

В данном примере запрос был выполнен **после**  того, когда Пользователь отклонил авторизацию ресурса Согласия.

###### Запрос получение ресурса согласия

```
GET /account-consents/urn-anybank-intent-99880 HTTP/1.1
Authorization: Bearer 2YotnFZFEjr1zCsicMWpAA
x-fapi-auth-date: Sun, 10 Sep 2024 19:43:31 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Accept: application/json
```

###### Ответ на получение ресурса согласия

```
HTTP/1.1 200 OK
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```
```json
{
  "Data": {
    "consentId": "urn-anybank-intent-99880",
    "status": "Rejected",
    "statusUpdateDateTime": "2024-05-02T00:05:00+00:00",
    "creationDateTime": "2024-05-02T00:00:00+00:00",
    "permissions": [
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadProducts",
      "ReadTransactionsCredits",
      "ReadTransactionsDebits",
      "ReadTransactionsDetail",
      "ReadPaymentCards"
    ],
    "expirationDateTime": "2024-08-02T00:00:00+00:00",
    "transactionFromDateTime": "2024-05-03T00:00:00+00:00",
    "transactionToDateTime": "2024-12-03T00:00:00+00:00"
  },
  "Links": {
    "self": "https://api.anybank.ru/open-banking/v2.0/aisp/account-consents/urn-anybank-intent-99880"
  },
  "Meta": {
    "totalPages": 1
  }
}
```

##### Удаление ресурса согласия

DELETE /account-consents позволяет СПИУ удалять ранее созданный ресурс Согласия account-consent не завизимо от того, был он авторизован или нет. Данный метод позволяет Пользователю отзывать согласие на стороне СПИУ и извещать ППИУ о том, что согласие отозвано.

###### Отзыв согласия на доступ к счету

```
DELETE /account-consents/urn-anybank-intent-99880 HTTP/1.1
Authorization: Bearer 2YotnFZFEjr1zCsicMWpAA
x-fapi-auth-date:  Sun, 10 Sep 2024 19:43:31 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
```

###### Ответ на отзыв согласия на доступ к счету

```
HTTP/1.1 204 No Content
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
```

##### Создание ресурса согласия на доступ к счету с пминимальными разрешениями

###### Пример создание ресурса Согласия на доступ к счету

```
POST /account-consents HTTP/1.1
Authorization: Bearer 2YotnFZFEjr1zCsicMWpAA
x-fapi-auth-date:  Sun, 10 Sep 2024 19:43:31 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
Accept: application/json
```

```json
{
  "Data": {
    "permissions": [
      "ReadAccountsBasic",
      "ReadBalances"
    ],
    "expirationDateTime": "2024-05-02T00:00:00+00:00",
    "transactionFromDateTime": "2024-05-03T00:00:00+00:00",
    "transactionToDateTime": "2024-12-03T00:00:00+00:00"
  }
}
```

###### Пример ответа на запрос создания Согласия на доступ к счету

```
HTTP/1.1 201 Created
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```
```json
{
  "Data": {
    "consentId": "urn-anybank-intent-99880",
    "status": "AwaitingAuthorisation",
    "statusUpdateDateTime": "2024-05-02T00:00:00+00:00",
    "creationDateTime": "2024-05-02T00:00:00+00:00",
    "status": "AwaitingAuthorisation",
    "permissions": [
      "ReadAccountsBasic",
      "ReadBalances"
    ],
    "expirationDateTime": "2024-08-02T00:00:00+00:00",
    "transactionFromDateTime": "2024-05-03T00:00:00+00:00",
    "transactionToDateTime": "2024-12-03T00:00:00+00:00"
  },
  "Links": {
    "self": "https://api.anybank.ru/open-banking/v2.0/aisp/account-consents/urn-anybank-intent-99880"
  },
  "Meta": {
    "totalPages": 1
  }
}