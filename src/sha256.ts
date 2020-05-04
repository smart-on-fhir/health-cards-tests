import { sha256 as sha256js, Message } from 'js-sha256'

export default function sha256(payload: Message): Buffer {
  return Buffer.from(sha256js.arrayBuffer(payload))
}

