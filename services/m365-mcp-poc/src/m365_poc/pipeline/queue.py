"""Message queue abstraction. The in-memory queue is for tests and local runs.

A Service Bus adapter would implement MessageQueue behind this interface. It is deliberately NOT implemented
here, so no Azure messaging resource is needed or contacted.
"""

from __future__ import annotations

import heapq
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol

from .models import DocumentEvent


@dataclass(order=True)
class QueuedMessage:
    visible_at: float
    seq: int
    event: DocumentEvent = field(compare=False)
    attempts: int = field(default=0, compare=False)


class MessageQueue(Protocol):
    def send(self, event: DocumentEvent, delay_seconds: float = 0.0) -> None: ...
    def receive(self) -> QueuedMessage | None: ...
    def requeue(self, message: QueuedMessage, delay_seconds: float) -> None: ...
    def dead_letter(self, message: QueuedMessage, reason: str) -> None: ...


class InMemoryQueue:
    def __init__(self, clock: Callable[[], float]) -> None:
        self._clock = clock
        self._heap: list[QueuedMessage] = []
        self._seq = 0
        self.dead_letters: list[tuple[QueuedMessage, str]] = []

    def send(self, event: DocumentEvent, delay_seconds: float = 0.0) -> None:
        self._seq += 1
        heapq.heappush(self._heap, QueuedMessage(self._clock() + delay_seconds, self._seq, event))

    def receive(self) -> QueuedMessage | None:
        if self._heap and self._heap[0].visible_at <= self._clock():
            return heapq.heappop(self._heap)
        return None

    def requeue(self, message: QueuedMessage, delay_seconds: float) -> None:
        self._seq += 1
        heapq.heappush(
            self._heap, QueuedMessage(self._clock() + delay_seconds, self._seq, message.event, message.attempts + 1)
        )

    def dead_letter(self, message: QueuedMessage, reason: str) -> None:
        self.dead_letters.append((message, reason))

    def __len__(self) -> int:
        return len(self._heap)
