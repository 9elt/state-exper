type OnChangeHandler<T, C extends object[]> = (captures: C, next: T, current: T) => void;

type Subscriber<T> = (WeakRef<object> | OnChangeHandler<T, any>)[];

class State<T> {
    static cleanups: WeakMap<WeakKey, Function[]> = new WeakMap;
    static registry: FinalizationRegistry<Function[]> = new FinalizationRegistry(
        (cleanups) => cleanups.forEach((cleanup) => cleanup())
    );
    _value: T;
    _subs: Subscriber<T>[];

    constructor(value: T) {
        this._value = value;
        this._subs = [];
    }

    get value(): T {
        return this._value;
    }

    set value(value: T) {
        for (const sub of this._subs) {
            const captures = new Array<object>(sub.length - 1);

            let dropped = false;
            for (let i = 0; i < captures.length; i++) {
                // @ts-expect-error
                const capture: object | undefined = sub[i].deref();

                if (capture === undefined) {
                    dropped = true;
                    break;
                }

                captures[i] = capture;
            }

            if (dropped) {
                remove(this._subs, sub);
                continue;
            }

            try {
                // @ts-expect-error
                sub[captures.length](captures, value, this._value);
            } catch {
                //
            }
        }

        this._value = value;
    }

    onChangeWeak<const C extends object[] | never[]>(f: OnChangeHandler<T, C>, captures: C | never[] = []): void {
        const sub: Subscriber<T> = new Array(captures.length + 1);

        for (let i = 0; i < captures.length; i++) {
            const capture = captures[i];

            sub[i] = new WeakRef(capture);

            const cleanups = State.cleanups.get(capture) ?? [];
            cleanups.push(() => remove(this._subs, sub));

            State.cleanups.set(capture, cleanups);
            State.registry.register(capture, cleanups);
        }

        sub[captures.length] = f;

        this._subs.push(sub);
    }
}

function remove<T>(arr: T[], exclude: T): void {
    let length = 0;
    for (let i = 0; i < arr.length; i++) {
        const sub = arr[i];

        if (sub !== exclude) {
            if (i > length) {
                arr[length] = sub;
            }
            length++;
        }
    }

    if (arr.length !== length) {
        arr.length = length;
    }
}

/*








*/

const color = new State("red");

const background = new State("blue");

function example() {
    const div = document.createElement("div");

    div.style.color = color.value;

    color.onChangeWeak(([div], value) => {
        div.style.color = value;
        Nested();
        AsyncNested();
    }, [div]);
}

function Nested() {
    // how do we track this?
    background.onChangeWeak(([], next, prev) => {
        next;
        prev;
    }, []);

    return (
        0
    );
}

async function AsyncNested() {
    await Promise.resolve();

    // how the hell do we track this?
    background.onChangeWeak(([], next, prev) => {
        next;
        prev;
    }, []);

    return (
        0
    );
}
