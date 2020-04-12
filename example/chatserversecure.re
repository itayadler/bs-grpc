let lastMessage = ref("out of the silent planet comes a message");
let credentials =
  Grpc.Server.Credentials.Ssl.make(
    ~rootCert=Grpc.loadCert("./certs/ca.dev.influential.co.crt"),
    ~privateKey=Grpc.loadCert("./certs/influential-dev-server-key.pem"),
    ~certChain=Grpc.loadCert("./certs/grpc-server.dev.influential.co.crt"),
  );
let chatService =
  Grpc.Chat.ChatService.t(~sendMessage=(call, callback) => {
    let request = call |> Grpc.Chat.ChatService.SendMessageRpc.requestGet;
    let message = request |> Grpc.Chat.Message.messageGet;
    let replyMessage = lastMessage^;
    switch (message) {
    | None => ()
    | Some(s) => lastMessage := s
    };
    let ack =
      Grpc.Chat.MessageAck.make(
        ~result=Grpc.Chat.MessageAck.Message(replyMessage),
        (),
      );
    Grpc.reply(callback, ack);
  });

let server = Grpc.Server.make("127.0.0.1:12345", ~credentials, ~chatService);