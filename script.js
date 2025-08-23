const SUPABASE_URL = 'https://bujffxasexuglgmtloxv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1amZmeGFzZXh1Z2xnbXRsb3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTY1NDAsImV4cCI6MjA3MTEzMjU0MH0.OmbttnQ6ThFCYuspr3IL2b25RULx_ZqoXUfcoN7KF_M';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function editarInsumo(id, nome, unidade, preco) {
    const modal = document.getElementById('modal-editar-insumo');
    document.getElementById('edit-insumo-id').value = id;
    document.getElementById('edit-nome-insumo').value = nome;
    document.getElementById('edit-unidade-medida').value = unidade;
    document.getElementById('edit-preco-unitario').value = preco;
    modal.style.display = 'block';
}

async function deletarInsumo(id, nome) {
    if (!confirm(`TEM CERTEZA QUE QUER DELETAR O INSUMO "${nome}"?`)) return;
    const { error } = await supabaseClient.from('insumos').delete().match({ id: id });
    if (error) {
        if (error.code === '23503') {
            alert(`ERRO: "${nome}" não pode ser deletado pois está em uso em alguma receita.`);
        } else {
            alert(`Não foi possível deletar o insumo "${nome}".`);
        }
    } else {
        alert(`Insumo "${nome}" deletado com sucesso!`);
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}

async function gerenciarProduto(produtoId) {
    const modal = document.getElementById('modal-gerenciar-produto');
    const { data: produto, error } = await supabaseClient.from('produtos').select('*').eq('id', produtoId).single();
    if (error) { return alert('Erro ao carregar dados do produto.'); }
    
    document.getElementById('nome-produto-modal').textContent = produto.nome;
    document.getElementById('gerenciar-produto-id').value = produto.id;
    document.getElementById('preco-final-definido').value = produto.preco_venda ? Number(produto.preco_venda).toFixed(2) : '';
    
    document.getElementById('lista-custos-adicionais').innerHTML = '';
    adicionarCampoDeCusto('Embalagem', 2.50);
    adicionarCampoDeCusto('Mão de Obra', 5.00);

    await carregarIngredientesNoModal(produtoId);
    modal.style.display = 'block';
}

async function deletarProduto(id, nome) {
    if (!confirm(`DELETAR PRODUTO "${nome}"?\n\nATENÇÃO: Todas as receitas e vendas associadas a ele também serão apagadas!`)) return;
    await supabaseClient.from('receitas').delete().match({ produto_id: id });
    await supabaseClient.from('notas_fiscais').delete().match({ cliente_id: id }); // Assumindo que o ID do cliente é o mesmo do produto, o que pode não ser o caso.
    const { error } = await supabaseClient.from('produtos').delete().match({ id: id });
    if (error) { alert(`Erro ao deletar o produto "${nome}".`); } 
    else { alert(`Produto "${nome}" deletado com sucesso!`); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
}

async function removerIngrediente(receitaItemId) {
    const { error } = await supabaseClient.from('receitas').delete().match({ id: receitaItemId });
    if (error) { alert('Erro ao remover ingrediente.'); }
    else { 
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        carregarIngredientesNoModal(produtoId);
    }
}

async function editarCliente(clienteId) {
    const modal = document.getElementById('modal-editar-cliente');
    const { data: cliente, error } = await supabaseClient.from('clientes').select('*').eq('id', clienteId).single();
    if (error) return alert('Erro ao carregar dados do cliente.');

    document.getElementById('edit-cliente-id').value = cliente.id;
    document.querySelector(`input[name="edit_tipo_pessoa"][value="${cliente.tipo_pessoa}"]`).checked = true;
    document.getElementById('edit-nome_razao_social').value = cliente.nome_razao_social;
    document.getElementById('edit-cpf_cnpj').value = cliente.cpf_cnpj;
    document.getElementById('edit-telefone').value = cliente.telefone;
    document.getElementById('edit-email').value = cliente.email;
    document.getElementById('edit-endereco').value = cliente.endereco;
    
    atualizarLabelsFormularioCliente('edit-');
    modal.style.display = 'block';
}

async function deletarCliente(id, nome) {
    if (!confirm(`DELETAR CLIENTE "${nome}"?\n\nIsso não poderá ser desfeito.`)) return;
    const { error } = await supabaseClient.from('clientes').delete().match({ id: id });
    if (error) {
        if (error.code === '23503') {
            alert(`ERRO: "${nome}" não pode ser deletado pois está associado a uma ou mais notas fiscais.`);
        } else {
            alert(`Erro ao deletar o cliente "${nome}".`);
        }
    } else {
        alert(`Cliente "${nome}" deletado com sucesso!`);
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}

async function carregarIngredientesNoModal(produtoId) {
    const { data, error } = await supabaseClient.from('receitas').select(`id, quantidade, insumos (nome, unidade_medida, preco_unitario)`).eq('produto_id', produtoId);
    const listaIngredientesModal = document.getElementById('lista-ingredientes-modal');
    if (error) { return; }
    window.ingredientesAtuais = data || [];
    listaIngredientesModal.innerHTML = '';
    if (window.ingredientesAtuais.length === 0) {
        listaIngredientesModal.innerHTML = '<li>Nenhum ingrediente adicionado.</li>';
    } else {
        window.ingredientesAtuais.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `${item.quantidade} ${item.insumos.unidade_medida} de ${item.insumos.nome} <button class="btn-remover-ingrediente" onclick="removerIngrediente(${item.id})">❌</button>`;
            listaIngredientesModal.appendChild(li);
        });
    }
    recalcularAnaliseDeCustos();
}

function adicionarCampoDeCusto(nome = '', valor = 0) {
    const listaCustosAdicionais = document.getElementById('lista-custos-adicionais');
    const div = document.createElement('div');
    div.className = 'custo-adicional-item';
    div.innerHTML = `
        <input type="text" value="${nome}" class="custo-nome" placeholder="Nome do Custo (ex: Gás)">
        <input type="number" value="${valor.toFixed(2)}" class="custo-valor" step="0.01">
        <button type="button" class="btn-remover-custo" onclick="this.parentElement.remove(); recalcularAnaliseDeCustos();">❌</button>
    `;
    listaCustosAdicionais.appendChild(div);
    div.querySelectorAll('input').forEach(input => input.addEventListener('input', recalcularAnaliseDeCustos));
};

function recalcularAnaliseDeCustos() {
    let custoIngredientes = (window.ingredientesAtuais || []).reduce((acc, item) => acc + (item.quantidade * (item.insumos.preco_unitario || 0)), 0);
    let outrosCustos = 0;
    document.querySelectorAll('.custo-adicional-item .custo-valor').forEach(input => {
        outrosCustos += parseFloat(input.value) || 0;
    });
    
    const custoTotal = custoIngredientes + outrosCustos;
    const margem = parseFloat(document.getElementById('margem-lucro').value) || 0;
    const lucro = custoTotal * (margem / 100);
    const precoSugerido = custoTotal + lucro;

    document.getElementById('custo-ingredientes-valor').textContent = `R$ ${custoIngredientes.toFixed(2)}`;
    document.getElementById('custo-total-valor').textContent = `R$ ${custoTotal.toFixed(2)}`;
    document.getElementById('preco-sugerido-valor').textContent = `R$ ${precoSugerido.toFixed(2)}`;
}

function atualizarLabelsFormularioCliente(prefixo = '') {
    const tipo = document.querySelector(`input[name="${prefixo ? prefixo + '_' : ''}tipo_pessoa"]:checked`).value;
    const labelNome = document.getElementById(`${prefixo}label-nome`);
    const labelDocumento = document.getElementById(`${prefixo}label-documento`);
    const inputNome = document.getElementById(`${prefixo}nome_razao_social`);
    const inputDocumento = document.getElementById(`${prefixo}cpf_cnpj`);

    if (tipo === 'Física') {
        labelNome.textContent = 'Nome Completo';
        inputNome.placeholder = 'Nome do cliente';
        labelDocumento.textContent = 'CPF';
        inputDocumento.placeholder = '___.___.___-__';
    } else {
        labelNome.textContent = 'Razão Social';
        inputNome.placeholder = 'Nome da empresa';
        labelDocumento.textContent = 'CNPJ';
        inputDocumento.placeholder = '__.___.___/____-__';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    let insumosData = [];
    let produtosData = [];
    let clientesData = [];
    let nfItens = [];

    const navButtons = document.querySelectorAll('nav button');
    const telas = document.querySelectorAll('main .tela');
    const modals = document.querySelectorAll('.modal');
    const formInsumos = document.getElementById('form-insumos');
    const formEditarInsumo = document.getElementById('form-editar-insumo');
    const formProdutos = document.getElementById('form-produtos');
    const formAdicionarIngrediente = document.getElementById('form-adicionar-ingrediente');
    const formClientes = document.getElementById('form-clientes');
    const formEditarCliente = document.getElementById('form-editar-cliente');
    const formAddNfItem = document.getElementById('form-add-nf-item');
    const btnSalvarNf = document.getElementById('btn-salvar-nf');

    function mostrarTela(targetId) {
        telas.forEach(tela => tela.classList.add('hidden'));
        const telaAlvo = document.getElementById(targetId);
        if (telaAlvo) telaAlvo.classList.remove('hidden');
    }

    navButtons.forEach(button => button.addEventListener('click', () => mostrarTela(button.getAttribute('data-target'))));
    
    modals.forEach(modal => {
        modal.querySelector('.close-button').onclick = () => modal.style.display = 'none';
    });
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    function renderizarTabelaInsumos() {
        const corpoTabela = document.getElementById('corpo-tabela-insumos');
        corpoTabela.innerHTML = '';
        if (insumosData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="4">Nenhum insumo cadastrado.</td></tr>';
            return;
        }
        insumosData.forEach(insumo => {
            const tr = document.createElement('tr');
            const preco = insumo.preco_unitario ? Number(insumo.preco_unitario).toFixed(2) : '0.00';
            tr.innerHTML = `
                <td>${insumo.nome}</td>
                <td>${insumo.unidade_medida}</td>
                <td>R$ ${preco}</td>
                <td class="actions-container">
                    <button class="btn-acao btn-warning" onclick="editarInsumo(${insumo.id}, '${insumo.nome}', '${insumo.unidade_medida}', ${insumo.preco_unitario || 0})">✏️</button>
                    <button class="btn-acao btn-danger" onclick="deletarInsumo(${insumo.id}, '${insumo.nome}')">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    formInsumos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabaseClient.from('insumos').insert([{ 
            nome: document.getElementById('nome-insumo').value, 
            unidade_medida: document.getElementById('unidade-medida').value, 
            preco_unitario: document.getElementById('preco-unitario').value 
        }]);
        if (error) { alert('Ocorreu um erro ao salvar.'); } 
        else { alert('Insumo salvo!'); formInsumos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });
    
    formEditarInsumo.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-insumo-id').value;
        const { error } = await supabaseClient.from('insumos').update({ 
            nome: document.getElementById('edit-nome-insumo').value, 
            unidade_medida: document.getElementById('edit-unidade-medida').value, 
            preco_unitario: document.getElementById('edit-preco-unitario').value 
        }).match({ id });
        if (error) { alert('Não foi possível salvar as alterações.'); } 
        else { alert('Insumo atualizado!'); document.getElementById('modal-editar-insumo').style.display = 'none'; document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    function renderizarTabelaProdutos() {
        const corpoTabela = document.getElementById('corpo-tabela-produtos');
        corpoTabela.innerHTML = '';
        if (produtosData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="3">Nenhum produto cadastrado.</td></tr>';
            return;
        }
        produtosData.forEach(produto => {
            const tr = document.createElement('tr');
            const precoVenda = produto.preco_venda ? `R$ ${Number(produto.preco_venda).toFixed(2)}` : '<span style="color: #aaa;">Não precificado</span>';
            tr.innerHTML = `
                <td>${produto.nome}</td>
                <td><strong>${precoVenda}</strong></td>
                <td class="actions-container">
                    <button class="btn-acao btn-info" onclick="gerenciarProduto(${produto.id})">⚙️ Gerenciar</button>
                    <button class="btn-acao btn-danger" onclick="deletarProduto(${produto.id}, '${produto.nome}')">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }
    
    formProdutos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabaseClient.from('produtos').insert([{ nome: document.getElementById('nome-produto').value }]);
        if (error) { alert('Erro ao salvar produto.'); } 
        else { alert('Produto salvo!'); formProdutos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    formAdicionarIngrediente.addEventListener('submit', async (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const { error } = await supabaseClient.from('receitas').insert([{ 
            produto_id: produtoId, 
            insumo_id: document.getElementById('select-insumo-receita').value, 
            quantidade: document.getElementById('quantidade-ingrediente').value 
        }]);
        if (error) { alert('Erro ao adicionar ingrediente.'); } 
        else { formAdicionarIngrediente.reset(); carregarIngredientesNoModal(produtoId); }
    });
    
    document.getElementById('btn-adicionar-custo').onclick = () => adicionarCampoDeCusto();
    document.getElementById('margem-lucro').addEventListener('input', recalcularAnaliseDeCustos);

    document.getElementById('btn-salvar-preco-venda').addEventListener('click', async () => {
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const precoFinal = document.getElementById('preco-final-definido').value;
        if (!precoFinal || precoFinal <= 0) { return alert('Defina um preço de venda válido.'); }
        const { error } = await supabaseClient.from('produtos').update({ preco_venda: precoFinal }).match({ id: produtoId });
        if (error) { alert('Erro ao salvar o preço.'); } 
        else { 
            alert('Preço de venda salvo com sucesso!');
            document.getElementById('modal-gerenciar-produto').style.display = 'none';
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
        }
    });

    function renderizarTabelaClientes() {
        const corpoTabela = document.getElementById('corpo-tabela-clientes');
        corpoTabela.innerHTML = '';
        if (clientesData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="4">Nenhum cliente cadastrado.</td></tr>';
            return;
        }
        clientesData.forEach(cliente => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cliente.nome_razao_social}</td>
                <td>${cliente.cpf_cnpj}</td>
                <td>${cliente.telefone || 'N/A'}</td>
                <td class="actions-container">
                    <button class="btn-acao btn-warning" onclick="editarCliente(${cliente.id})">✏️</button>
                    <button class="btn-acao btn-danger" onclick="deletarCliente(${cliente.id}, '${cliente.nome_razao_social}')">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    document.querySelectorAll('input[name="tipo_pessoa"]').forEach(radio => {
        radio.addEventListener('change', () => atualizarLabelsFormularioCliente());
    });
    document.querySelectorAll('input[name="edit_tipo_pessoa"]').forEach(radio => {
        radio.addEventListener('change', () => atualizarLabelsFormularioCliente('edit-'));
    });

    formClientes.addEventListener('submit', async (event) => {
        event.preventDefault();
        const cliente = {
            tipo_pessoa: document.querySelector('input[name="tipo_pessoa"]:checked').value,
            nome_razao_social: document.getElementById('nome_razao_social').value,
            cpf_cnpj: document.getElementById('cpf_cnpj').value,
            telefone: document.getElementById('telefone').value,
            email: document.getElementById('email').value,
            endereco: document.getElementById('endereco').value,
        };
        const { error } = await supabaseClient.from('clientes').insert([cliente]);
        if (error) { alert('Erro ao salvar cliente.'); } 
        else { alert('Cliente salvo com sucesso!'); formClientes.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    formEditarCliente.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-cliente-id').value;
        const cliente = {
            tipo_pessoa: document.querySelector('input[name="edit_tipo_pessoa"]:checked').value,
            nome_razao_social: document.getElementById('edit-nome_razao_social').value,
            cpf_cnpj: document.getElementById('edit-cpf_cnpj').value,
            telefone: document.getElementById('edit-telefone').value,
            email: document.getElementById('edit-email').value,
            endereco: document.getElementById('edit-endereco').value,
        };
        const { error } = await supabaseClient.from('clientes').update(cliente).match({ id });
        if (error) { alert('Erro ao atualizar cliente.'); } 
        else { alert('Cliente atualizado com sucesso!'); document.getElementById('modal-editar-cliente').style.display = 'none'; document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    function renderizarItensNf() {
        const container = document.getElementById('nf-itens-container');
        container.innerHTML = '';
        if (nfItens.length === 0) {
            container.innerHTML = '<p class="placeholder">Adicione produtos à nota...</p>';
        } else {
            nfItens.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'nf-item';
                itemDiv.innerHTML = `
                    <span>${item.quantidade}x ${item.nome}</span>
                    <strong>R$ ${(item.quantidade * item.preco_unitario_momento).toFixed(2)}</strong>
                    <button class="btn-remover-ingrediente" onclick="removerItemNf(${index})">❌</button>
                `;
                container.appendChild(itemDiv);
            });
        }
        const total = nfItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        document.getElementById('nf-valor-total').textContent = `R$ ${total.toFixed(2)}`;
    }

    window.removerItemNf = function(index) {
        nfItens.splice(index, 1);
        renderizarItensNf();
    }

    formAddNfItem.addEventListener('submit', (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('nf-produto').value;
        const produtoSelecionado = produtosData.find(p => p.id == produtoId);
        if (!produtoSelecionado) return alert('Selecione um produto válido.');
        if (!produtoSelecionado.preco_venda) return alert('Este produto não foi precificado. Vá para a tela de Produtos para definir um preço.');
        
        nfItens.push({
            produto_id: produtoId,
            nome: produtoSelecionado.nome,
            quantidade: parseFloat(document.getElementById('nf-quantidade').value),
            preco_unitario_momento: parseFloat(produtoSelecionado.preco_venda)
        });
        renderizarItensNf();
        formAddNfItem.reset();
    });

    btnSalvarNf.addEventListener('click', async () => {
        if (nfItens.length === 0) return alert('Adicione pelo menos um produto à nota.');
        const clienteId = document.getElementById('nf-cliente').value;
        if (!clienteId) return alert('Selecione um cliente.');

        const valorTotal = nfItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        
        const { data: notaFiscal, error } = await supabaseClient.from('notas_fiscais').insert([{
            cliente_id: clienteId,
            valor_total: valorTotal,
            status_pagamento: document.getElementById('nf-status-pagamento').value,
            metodo_pagamento: document.getElementById('nf-metodo-pagamento').value
        }]).select().single();

        if (error) return alert('Erro ao salvar a nota fiscal.');

        const itensParaSalvar = nfItens.map(item => ({
            nota_fiscal_id: notaFiscal.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario_momento: item.preco_unitario_momento
        }));

        const { error: errorItens } = await supabaseClient.from('nota_fiscal_itens').insert(itensParaSalvar);

        if (errorItens) {
            alert('Erro ao salvar os itens da nota. A nota principal foi criada mas está vazia.');
        } else {
            alert('Nota Fiscal salva com sucesso!');
            nfItens = [];
            renderizarItensNf();
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
        }
    });

    async function renderizarTabelaNotasFiscais() {
        const { data, error } = await supabaseClient.from('notas_fiscais').select(`*, clientes(nome_razao_social)`).order('created_at', { ascending: false });
        const corpoTabela = document.getElementById('corpo-tabela-notas-fiscais');
        corpoTabela.innerHTML = '';
        if (!data || data.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="5">Nenhuma nota fiscal emitida.</td></tr>';
            return;
        }
        data.forEach(nf => {
            const tr = document.createElement('tr');
            const statusClass = nf.status_pagamento === 'Pago' ? 'status-pago' : 'status-pendente';
            tr.innerHTML = `
                <td>${new Date(nf.created_at).toLocaleDateString('pt-BR')}</td>
                <td>${nf.clientes.nome_razao_social}</td>
                <td>R$ ${Number(nf.valor_total).toFixed(2)}</td>
                <td><span class="status ${statusClass}">${nf.status_pagamento}</span></td>
                <td class="actions-container">
                    <button class="btn-acao btn-info" title="Ver Detalhes">👁️</button>
                    <button class="btn-acao btn-success" title="Marcar como Pago" onclick="marcarComoPago(${nf.id})">✔️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    window.marcarComoPago = async function(nfId) {
        const { error } = await supabaseClient.from('notas_fiscais').update({ status_pagamento: 'Pago' }).match({ id: nfId });
        if (error) { alert('Erro ao atualizar status.'); }
        else { document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    }
    
    async function atualizarTodosOsDados() {
        const [insumosResult, produtosResult, clientesResult] = await Promise.all([
            supabaseClient.from('insumos').select('*').order('nome'),
            supabaseClient.from('produtos').select('*').order('nome'),
            supabaseClient.from('clientes').select('*').order('nome_razao_social')
        ]);
        
        insumosData = insumosResult.data || [];
        produtosData = produtosResult.data || [];
        clientesData = clientesResult.data || [];
        
        renderizarTabelaInsumos();
        renderizarTabelaProdutos();
        renderizarTabelaClientes();
        
        const selectInsumo = document.getElementById('select-insumo-receita');
        const selectProdutoVenda = document.getElementById('nf-produto');
        const selectClienteVenda = document.getElementById('nf-cliente');
        
        selectInsumo.innerHTML = '<option value="">Selecione...</option>';
        selectProdutoVenda.innerHTML = '<option value="">Selecione...</option>';
        selectClienteVenda.innerHTML = '<option value="">Selecione...</option>';
        
        insumosData.forEach(i => selectInsumo.innerHTML += `<option value="${i.id}">${i.nome}</option>`);
        produtosData.forEach(p => selectProdutoVenda.innerHTML += `<option value="${p.id}">${p.nome} - R$ ${p.preco_venda ? Number(p.preco_venda).toFixed(2) : '?.??'}</option>`);
        clientesData.forEach(c => selectClienteVenda.innerHTML += `<option value="${c.id}">${c.nome_razao_social}</option>`);
        
        await renderizarTabelaNotasFiscais();
    }
    
    document.addEventListener('dadosAtualizados', atualizarTodosOsDados);
    
    mostrarTela('tela-insumos');
    atualizarTodosOsDados();
});
