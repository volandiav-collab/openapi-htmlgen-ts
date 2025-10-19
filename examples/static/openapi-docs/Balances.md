## Примеры использования получения остатка на счете

### Правила указание суммы остатка
При получении информации о балансе необходимо учитывать следующие условия наличия элемента `CreditLine` и значение его свойства`included`:
- Наличие в ответе блока  `CreditLine` означает, что Пользователю предоставлена кредитная линия. или овердрафт. 
- Если значение парметра `included` равно `false`, то это означает, что данная сумма доступна Пользователю для операций (предоставляемый кредитный лимит или овердрафт), не была использована и не отражается на остатке по счету (`Balance/Amount`).
- Если значение парметра `included` равно `true`, то это означает, что данная сумма была использована Пользователем и это уже отраженно на остатке по счету.
При предоставлении информации Пользователю, следует указывать, является ли сумма доступных средств на счете остатом собственных средств, либо учитывает наличие кредитной линии. 

### Параметр `creditDebitIndicator`
В сообщениях об остатке на счете параметр `debetCreditIndicator` указывает, является ли сумма дебетовой или кредитовой по отношению к счету. Если остаток на счете положительный, то он считается кредитовым, и в этом случае значение параметра `DebetCreditIndicator` должно быть `Credit`.
Таким образом следует указывать:
- `Credit` — если остаток положительный (кредитовый);
— `Debit` если остаток отрицательный (дебетовый).

### Получение остатка по всем счетам, на которые дано согласие Пользователя

#### Пример 1

Данный пример показывает положительный остаток на счете 200200 в 800 рублей и 200201 в 100 рублей которые доступны Пользователю для совершения операций. При этом на обоих счетах отсутствует кредитная линия или овердрафт.

##### Запрос

```http
GET /balances HTTP/1.1
Authorization: Bearer Az90SAOJklae
x-fapi-auth-date: Sun, 10 Sep 2021 15:15:01 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Accept: application/json
```

##### Ответ

```http
HTTP/1.1 200 OK
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```

```json
{
  "Data": {
    "Balance": [
      {
        "accountId": "200200",
        "type": "interimAvailable",
        "Amount": {
          "amount": "800.00",
          "currency": "RUB"
        },
        "creditDebitIndicator": "Credit",
        "dateTime": "2021-06-05T15:15:13+00:00",
      },
      {
        "accountId": "200201",
        "type": "interimAvailable",
        "Amount": {
          "amount": "100.00",
          "currency": "RUB"
        },
        "creditDebitIndicator": "Credit",
        "dateTime": "2021-06-05T15:15:13+00:00",
      }
    ]
  },
  "Links": {
    "self": "https://sb.example.ru/v2.0/balances"
  },
  "Meta": {
    "totalPages": 1
  }
}
```
### Получение остатка на счете по идентификатору

#### Пример 1

Данный пример показывает положительный остаток на счете в 800 рублей, которые доступны Пользователю для совершения операций. При этом на счете отсутствует кредитная линия или овердрафт.

##### Запрос

```http
GET /accounts/200200/balances HTTP/1.1
Authorization: Bearer Az90SAOJklae
x-fapi-auth-date: Sun, 10 Sep 2021 15:15:01 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Accept: application/json
```

##### Ответ

```http
HTTP/1.1 200 OK
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```

```json
{
  "Data": {
    "Balance": [
      {
        "accountId": "200200",
        "type": "interimAvailable",
        "Amount": {
          "amount": "800.00",
          "currency": "RUB"
        },
        "creditDebitIndicator": "Credit",
        "dateTime": "2021-06-05T15:15:13+00:00",
      }
    ]
  },
  "Links": {
    "self": "https://sb.example.ru/v2.0/accounts/200200/balances"
  },
  "Meta": {
    "totalPages": 1
  }
}
```
### Получение остатка на счете по идентификатору при наличии кредитной линии
#### Пример 2

Данный пример показывает положительный остаток на счете 800 рублей но при этом ему предоставлена кредитная линиия в 500 рублей, которую он не использовал. При этом пользователю доступно 1100 рублей для совершения операций.

#### Запрос

```http
GET /accounts/200200/balances HTTP/1.1
Authorization: Bearer Az90SAOJklae
x-fapi-auth-date: Sun, 10 Sep 2021 15:15:01 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Accept: application/json
```

#### Ответ

```http
HTTP/1.1 200 OK
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```

```json
{
  "Data": {
    "Balance": [
      {
        "accountId": "200200",
        "type": "interimAvailable",
        "Amount": {
          "amount": "800.00",
          "currency": "RUB"
        },
        "creditDebitIndicator": "Credit",
        "dateTime": "2021-06-05T15:15:13+00:00",
        "CreditLine": [
          {
            "included": false,
            "Amount": {
              "amount": "500.00",
              "currency": "RUB"
            }
          }
        ]
      }
    ]
  },
  "Links": {
    "self": "https://sb.example.ru/v2.0/accounts/200200/balances"
  },
  "Meta": {
    "totalPages": 1
  }
}
```

### Получение остатка на счете по идентификатору при отрицательном остатке
#### Пример 3

Данный пример показывает отрицательный остаток на счете в 100 рублей и при этом у него имеется кредитная линия в 500 рублей, часть которой (400 рублей) он использовал и это отражено в остатке на счете. кредитной линии (400 рублей) была использована.  Это означает, что у Пользователя на счете доступно 400 рублей свободных средств при отрицательном остатке собственных средств в 100 рублей.

#### Запрос

```http
GET /accounts/200200/balances HTTP/1.1
Authorization: Bearer Az90SAOJklae
x-fapi-auth-date: Sun, 10 Sep 2021 15:15:01 GMT
x-fapi-customer-ip-address: 104.25.212.99
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Accept: application/json
```

#### Ответ

```http
HTTP/1.1 200 OK
x-fapi-interaction-id: 93bac548-d2de-4546-b106-880a5018460d
Content-Type: application/json
```

```json
{
  "Data": {
    "Balance": [
      {
        "accountId": "200200",
        "type": "interimAvailable",
        "Amount": {
          "amount": "100.00",
          "currency": "RUB"
        },
        "creditDebitIndicator": "Debit",
        "dateTime": "2021-06-05T15:15:13+00:00",
        "CreditLine": [
          {
            "included": true,
            "Amount": {
              "amount": "400.00",
              "currency": "RUB"
            },
            "included": false,
            "Amount": {
              "amount": "500.00",
              "currency": "RUB"
            }            
          }
        ]
      }
    ]
  },
  "Links": {
    "self": "https://sb.example.ru/v2.0/accounts/200200/balances"
  },
  "Meta": {
    "totalPages": 1
  }
}
```
