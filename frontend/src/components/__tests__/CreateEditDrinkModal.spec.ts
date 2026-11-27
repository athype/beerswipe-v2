import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, reactive } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import CreateEditDrinkModal from '../modals/CreateEditDrinkModal.vue'

interface DrinkForm {
  name: string
  description: string
  price: number
  stock: number
  category: string
  barcode: string
  isActive: boolean
  isAlcohol: boolean
}

const createForm = (): DrinkForm =>
  reactive({
    name: 'Heineken',
    description: 'Pilsner',
    price: 2,
    stock: 24,
    category: 'beverage',
    barcode: '',
    isActive: true,
    isAlcohol: true,
  })

const BarcodeScannerModalStub = {
  name: 'BarcodeScannerModal',
  emits: ['close', 'detected'],
  template: '<div data-test="barcode-scanner-stub"></div>',
}

let wrappers: VueWrapper[] = []

const mountModal = (form: DrinkForm = createForm(), show = true) => {
  const wrapper = mount(CreateEditDrinkModal, {
    props: {
      show,
      isEdit: false,
      form,
    },
    global: {
      stubs: {
        BarcodeScannerModal: BarcodeScannerModalStub,
      },
    },
    attachTo: document.body,
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  for (const wrapper of wrappers) {
    wrapper.unmount()
  }
  wrappers = []
  document.body.innerHTML = ''
})

describe('CreateEditDrinkModal', () => {
  it('mounts the scanner when Scan is clicked without emitting submit', async () => {
    const wrapper = mountModal()

    const scanButton = document.body.querySelector(
      'button[aria-label="Scan barcode with camera"]'
    ) as HTMLButtonElement | null

    expect(scanButton).not.toBeNull()
    expect(scanButton?.type).toBe('button')
    expect(wrapper.findComponent(BarcodeScannerModalStub).exists()).toBe(false)

    scanButton?.click()
    await nextTick()

    expect(wrapper.findComponent(BarcodeScannerModalStub).exists()).toBe(true)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('fills form.barcode, shows the scanned hint, and closes the scanner on detected', async () => {
    const form = createForm()
    const wrapper = mountModal(form)

    const scanButton = document.body.querySelector(
      'button[aria-label="Scan barcode with camera"]'
    ) as HTMLButtonElement | null
    scanButton?.click()
    await nextTick()

    const scanner = wrapper.findComponent(BarcodeScannerModalStub)
    expect(scanner.exists()).toBe(true)

    scanner.vm.$emit('detected', '8712345678901')
    await nextTick()
    await nextTick()

    expect(form.barcode).toBe('8712345678901')
    expect(wrapper.findComponent(BarcodeScannerModalStub).exists()).toBe(false)
    expect(wrapper.emitted('submit')).toBeUndefined()

    const hint = document.body.querySelector('.barcode-scanned-hint')
    expect(hint?.textContent?.trim()).toBe('Scanned 8712345678901')

    const input = document.body.querySelector(
      '#drink-barcode'
    ) as HTMLInputElement | null
    expect(document.activeElement).toBe(input)
  })

  it('clears the scanned hint when the user types and resets scanner state when closed', async () => {
    const form = createForm()
    const wrapper = mountModal(form)

    const scanButton = document.body.querySelector(
      'button[aria-label="Scan barcode with camera"]'
    ) as HTMLButtonElement | null
    scanButton?.click()
    await nextTick()

    wrapper.findComponent(BarcodeScannerModalStub).vm.$emit('detected', '5449000000996')
    await nextTick()

    expect(document.body.querySelector('.barcode-scanned-hint')?.textContent?.trim()).toBe(
      'Scanned 5449000000996'
    )

    const input = document.body.querySelector('#drink-barcode') as HTMLInputElement
    input.value = '5449000000997'
    input.dispatchEvent(new Event('input'))
    await nextTick()

    expect(document.body.querySelector('.barcode-scanned-hint')).toBeNull()

    scanButton?.click()
    await nextTick()
    expect(wrapper.findComponent(BarcodeScannerModalStub).exists()).toBe(true)

    await wrapper.setProps({ show: false })
    await nextTick()

    expect(wrapper.findComponent(BarcodeScannerModalStub).exists()).toBe(false)
  })
})
