import { useState } from "react";
import { Textarea, Spinner, Button } from "@nextui-org/react";

function GptPage() {
  const [isSending, setIsSending] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [responseMessage, setResponseMessage] = useState("");

  const onSend = async () => {
    setIsSending(true);
    const response = await fetch("http://localhost:3040/v1/chat/completions", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer my_gpt_auth",
      },
      method: "POST",
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
      }),
    });

    const responseJson = await response.json();

    setResponseMessage(responseJson?.choices?.[0]?.message?.content);
    setIsSending(false);
  };

  return (
    <div className="px-6 py-8">
      <div className="flex gap-4 items-center">
        <Textarea
          label="Prompt"
          placeholder="Enter your prompt"
          className="max-w-lg"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <Button color="primary" onClick={onSend}>
          Send
        </Button>
        {isSending && <Spinner />}
      </div>

      <div className="mt-6">{responseMessage}</div>
    </div>
  );
}

export default GptPage;
