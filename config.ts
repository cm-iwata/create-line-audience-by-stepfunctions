export type Config = {
    connectionArn: string
    connectionName: string
    connectionSecretArn: string
}


export const getConfig = (): Config => {

    return {
        connectionArn: '<作成したEventBridgeのConnectionのArn>',
        connectionName: 'line-messaging-api-token',
        connectionSecretArn: '<作成したEventBridgeのConnectionのSecretArn>',
    }
}