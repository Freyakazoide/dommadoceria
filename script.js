const SUPABASE_URL = 'https://bujffxasexuglgmtloxv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1amZmeGFzZXh1Z2xnbXRsb3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTY1NDAsImV4cCI6MjA3MTEzMjU0MH0.OmbttnQ6ThFCYuspr3IL2b25RULx_ZqoXUfcoN7KF_M';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 10000);
}

function parsePapeis(papeis) {
    if (typeof papeis === 'string') {
        try {
            return JSON.parse(papeis);
        } catch (e) {
            return [];
        }
    }
    return Array.isArray(papeis) ? papeis : [];
}

// Em script.js
async function editarInsumo(id) {
    const modal = document.getElementById('modal-editar-insumo');

    const { data: insumo, error } = await supabaseClient
        .from('insumos')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !insumo) {
        showNotification('Erro ao carregar dados do insumo para edição.', 'error');
        console.error('Erro ao buscar insumo:', error);
        return;
    }

    document.getElementById('edit-insumo-id').value = insumo.id;
    document.getElementById('edit-nome-insumo').value = insumo.nome;
    document.getElementById('edit-unidade-medida').value = insumo.unidade_medida;
    document.getElementById('edit-preco-unitario').value = Number(insumo.preco_unitario || 0).toFixed(4);
    document.getElementById('edit-nivel_minimo_estoque').value = insumo.nivel_minimo_estoque || 0;

    // Limpa os campos de cálculo para que o usuário possa inserir novos valores
    document.getElementById('edit-preco-compra').value = '';
    document.getElementById('edit-quantidade-compra').value = '';

    modal.style.display = 'block';
}

async function deletarInsumo(id, nome) {
    if (!confirm(`TEM CERTEZA QUE QUER DELETAR O INSUMO "${nome}"?`)) return;
    const { error } = await supabaseClient.from('insumos').delete().match({ id: id });
    if (error) {
        if (error.code === '23503') {
            showNotification(`ERRO: "${nome}" não pode ser deletado pois está em uso.`, 'error');
        } else {
            showNotification(`Não foi possível deletar o insumo "${nome}".`, 'error');
        }
    } else {
        showNotification(`Insumo "${nome}" deletado com sucesso!`);
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}

async function gerenciarProduto(produtoId) {
    const modal = document.getElementById('modal-gerenciar-produto');
    const { data: produto, error } = await supabaseClient.from('produtos').select('*').eq('id', produtoId).single();
    if (error) { return showNotification('Erro ao carregar dados do produto.', 'error'); }
    
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
    if (!confirm(`DELETAR PRODUTO "${nome}"?\n\nATENÇÃO: Todas as receitas e notas fiscais associadas a ele também serão apagadas!`)) return;
    
    await supabaseClient.from('nota_fiscal_itens').delete().match({ produto_id: id });
    await supabaseClient.from('receitas').delete().match({ produto_id: id });
    const { error } = await supabaseClient.from('produtos').delete().match({ id: id });

    if (error) { 
        showNotification(`Erro ao deletar o produto "${nome}".`, 'error'); 
        console.error('Erro ao deletar produto:', error);
    } 
    else { 
        showNotification(`Produto "${nome}" deletado com sucesso!`); 
        document.dispatchEvent(new CustomEvent('dadosAtualizados')); 
    }
}

async function removerIngrediente(receitaItemId) {
    const { error } = await supabaseClient.from('receitas').delete().match({ id: receitaItemId });
    if (error) { showNotification('Erro ao remover ingrediente.', 'error'); }
    else { 
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        carregarIngredientesNoModal(produtoId);
    }
}

async function editarContato(contatoId) {
    const modal = document.getElementById('modal-editar-contato');
    const { data: contato, error } = await supabaseClient.from('contatos').select('*').eq('id', contatoId).single();
    if (error) return showNotification('Erro ao carregar dados do contato.', 'error');

    document.getElementById('edit-contato-id').value = contato.id;
    document.getElementById('edit-contato-nome').value = contato.nome_razao_social;
    document.getElementById('edit-contato-documento').value = contato.cpf_cnpj;
    document.getElementById('edit-contato-telefone').value = contato.telefone;
    document.getElementById('edit-contato-email').value = contato.email;
    document.getElementById('edit-contato-endereco').value = contato.endereco;
    
    const papeis = parsePapeis(contato.papeis);
    document.getElementById('edit-contato-e-cliente').checked = papeis.includes('Cliente');
    document.getElementById('edit-contato-e-fornecedor').checked = papeis.includes('Fornecedor');
    
    document.querySelector(`input[name="edit_tipo_pessoa"][value="${contato.tipo_pessoa}"]`).checked = true;
    atualizarLabelsFormularioContato('edit-');
    modal.style.display = 'block';
}

async function deletarContato(id, nome) {
    if (!confirm(`DELETAR CONTATO "${nome}"?\n\nIsso não poderá ser desfeito.`)) return;
    const { error } = await supabaseClient.from('contatos').delete().match({ id: id });
    if (error) {
        if (error.code === '23503') {
            showNotification(`ERRO: "${nome}" não pode ser deletado pois está associado a notas.`, 'error');
        } else {
            showNotification(`Erro ao deletar o contato "${nome}".`, 'error');
        }
    } else {
        showNotification(`Contato "${nome}" deletado com sucesso!`);
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

async function verDetalhesNota(notaId) {
    const modal = document.getElementById('modal-ver-nota');
    const container = document.getElementById('detalhes-nota-conteudo');
    container.innerHTML = '<p>Carregando...</p>';
    modal.style.display = 'block';

    const { data: nota, error } = await supabaseClient.from('notas_fiscais').select(`*, contatos(nome_razao_social)`).eq('id', notaId).single();
    if (error) { container.innerHTML = '<p>Erro ao carregar detalhes.</p>'; return; }

    const { data: itens, errorItens } = await supabaseClient.from('nota_fiscal_itens').select(`*, produtos(nome)`).eq('nota_fiscal_id', notaId);
    if (errorItens) { container.innerHTML = '<p>Erro ao carregar itens da nota.</p>'; return; }

    let html = `
        <p><strong>Cliente:</strong> ${nota.contatos.nome_razao_social}</p>
        <p><strong>Data:</strong> ${new Date(nota.created_at).toLocaleDateString('pt-BR')}</p>
        <p><strong>Status:</strong> ${nota.status_pagamento}</p>
        <p><strong>Método:</strong> ${nota.metodo_pagamento}</p>
        <hr>
        <h4>Itens:</h4>
        <ul>
    `;
    if (Array.isArray(itens)) {
        itens.forEach(item => {
            html += `<li>${item.quantidade}x ${item.produtos.nome} - R$ ${Number(item.preco_unitario_momento).toFixed(2)} (un)</li>`;
        });
    }
    html += `</ul><hr><p class="linha-custo total"><strong>TOTAL: R$ ${Number(nota.valor_total).toFixed(2)}</strong></p>`;
    container.innerHTML = html;
}

async function marcarComoPago(notaId) {
    if (!confirm('Deseja marcar esta nota como PAGA?')) return;
    const { error } = await supabaseClient.from('notas_fiscais').update({ status_pagamento: 'Pago' }).match({ id: notaId });
    if (error) { showNotification('Erro ao atualizar status.', 'error'); }
    else { document.dispatchEvent(new CustomEvent('dadosAtualizados', { detail: { highlightedId: notaId } })); }
}

async function deletarNota(notaId) {
    if (!confirm('TEM CERTEZA QUE QUER DELETAR ESTA NOTA FISCAL?\nEsta ação não pode ser desfeita.')) return;
    await supabaseClient.from('nota_fiscal_itens').delete().match({ nota_fiscal_id: notaId });
    const { error } = await supabaseClient.from('notas_fiscais').delete().match({ id: notaId });
    if (error) { showNotification('Erro ao deletar a nota fiscal.', 'error'); }
    else { 
        showNotification('Nota fiscal deletada com sucesso.'); 
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}

let editNsItens = [];

function renderizarItensNs() {
    const container = document.getElementById('edit-ns-itens-container');
    container.innerHTML = '';
    if (editNsItens.length === 0) {
        container.innerHTML = '<p class="placeholder">Adicione produtos...</p>';
    } else {
        editNsItens.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'nf-item';
            itemDiv.innerHTML = `
                <span>${item.quantidade}x ${item.nome}</span>
                <strong>R$ ${(item.quantidade * item.preco_unitario_momento).toFixed(2)}</strong>
                <button type="button" class="btn-remover-ingrediente" onclick="removerItemNs(${index})">❌</button>
            `;
            container.appendChild(itemDiv);
        });
    }
    const total = editNsItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
    document.getElementById('edit-ns-valor-total').textContent = `R$ ${total.toFixed(2)}`;
}

window.removerItemNs = function(index) {
    editNsItens.splice(index, 1);
    renderizarItensNs();
}

async function editarNotaSaida(notaId) {
    const modal = document.getElementById('modal-editar-nota-saida');
    document.getElementById('edit-ns-hidden-id').value = notaId;
    document.getElementById('edit-ns-id').textContent = `(#${notaId})`;

    const { data: nota, error } = await supabaseClient.from('notas_fiscais').select(`*, contatos(id)`).eq('id', notaId).single();
    if (error) return showNotification('Erro ao carregar dados da nota.', 'error');

    const { data: itens, errorItens } = await supabaseClient.from('nota_fiscal_itens').select(`*, produtos(*)`).eq('nota_fiscal_id', notaId);
    if (errorItens) return showNotification('Erro ao carregar itens da nota.', 'error');
    
    document.getElementById('edit-ns-cliente').value = nota.contatos.id;
    document.getElementById('edit-ns-metodo-pagamento').value = nota.metodo_pagamento;
    document.getElementById('edit-ns-status-pagamento').value = nota.status_pagamento;
    
    editNsItens = itens.map(item => ({
        id: item.id,
        produto_id: item.produtos.id,
        nome: item.produtos.nome,
        quantidade: item.quantidade,
        preco_unitario_momento: parseFloat(item.preco_unitario_momento)
    }));
    renderizarItensNs();
    
    modal.style.display = 'block';
}

async function verDetalhesNotaEntrada(notaId) {
    const modal = document.getElementById('modal-ver-nota-entrada');
    const container = document.getElementById('detalhes-ne-conteudo');
    container.innerHTML = '<p>Carregando...</p>';
    modal.style.display = 'block';

    const { data: nota, error } = await supabaseClient.from('notas_entrada').select(`*, contatos(nome_razao_social)`).eq('id', notaId).single();
    if (error) { container.innerHTML = '<p>Erro ao carregar detalhes da compra.</p>'; return; }

    const { data: itens, errorItens } = await supabaseClient.from('nota_entrada_itens').select(`*, insumos(nome, unidade_medida)`).eq('nota_entrada_id', notaId);
    if (errorItens) { container.innerHTML = '<p>Erro ao carregar insumos da compra.</p>'; return; }

    let html = `
        <p><strong>Fornecedor:</strong> ${nota.contatos.nome_razao_social}</p>
        <p><strong>Data da Compra:</strong> ${new Date(nota.data_compra).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
        <hr>
        <h4>Insumos Comprados:</h4>
        <ul>
    `;
    if (Array.isArray(itens)) {
        itens.forEach(item => {
            html += `<li>${item.quantidade} ${item.insumos.unidade_medida} de ${item.insumos.nome} - R$ ${Number(item.preco_unitario_momento).toFixed(2)} (un)</li>`;
        });
    }
    html += `</ul><hr><p class="linha-custo total"><strong>TOTAL: R$ ${Number(nota.valor_total).toFixed(2)}</strong></p>`;
    container.innerHTML = html;
}

let editNeItens = [];

function renderizarItensNeEdicao() {
    const container = document.getElementById('edit-ne-itens-container');
    container.innerHTML = '';
    if (editNeItens.length === 0) {
        container.innerHTML = '<p class="placeholder">Adicione insumos...</p>';
    } else {
        editNeItens.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'nf-item';
            itemDiv.innerHTML = `
                <span>${item.quantidade} x ${item.nome} (R$ ${item.preco_unitario_momento.toFixed(2)})</span>
                <strong>R$ ${(item.quantidade * item.preco_unitario_momento).toFixed(2)}</strong>
                <button type="button" class="btn-remover-ingrediente" onclick="removerItemNeEdicao(${index})">❌</button>
            `;
            container.appendChild(itemDiv);
        });
    }
    const total = editNeItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
    document.getElementById('edit-ne-valor-total').textContent = `R$ ${total.toFixed(2)}`;
}

window.removerItemNeEdicao = function(index) {
    editNeItens.splice(index, 1);
    renderizarItensNeEdicao();
}

async function editarNotaEntrada(notaId) {
    const modal = document.getElementById('modal-editar-nota-entrada');
    document.getElementById('edit-ne-hidden-id').value = notaId;
    document.getElementById('edit-ne-id').textContent = `(#${notaId})`;

    const { data: nota, error } = await supabaseClient.from('notas_entrada').select(`*, contatos(id)`).eq('id', notaId).single();
    if (error) return showNotification('Erro ao carregar dados da compra.', 'error');

    const { data: itens, errorItens } = await supabaseClient.from('nota_entrada_itens').select(`*, insumos(*)`).eq('nota_entrada_id', notaId);
    if (errorItens) return showNotification('Erro ao carregar itens da compra.', 'error');

    document.getElementById('edit-ne-fornecedor').value = nota.contatos.id;
    document.getElementById('edit-ne-data').value = nota.data_compra;

    editNeItens = itens.map(item => ({
        id: item.id,
        insumo_id: item.insumos.id,
        nome: item.insumos.nome,
        quantidade: item.quantidade,
        preco_unitario_momento: parseFloat(item.preco_unitario_momento)
    }));
    renderizarItensNeEdicao();
    
    modal.style.display = 'block';
}

async function deletarNotaEntrada(notaId) {
    if (!confirm('TEM CERTEZA QUE QUER DELETAR ESTA NOTA DE COMPRA?\nEsta ação não pode ser desfeita.')) return;
    await supabaseClient.from('nota_entrada_itens').delete().match({ nota_entrada_id: notaId });
    const { error } = await supabaseClient.from('notas_entrada').delete().match({ id: notaId });
    if (error) { 
        showNotification('Erro ao deletar a nota de compra.', 'error');
        console.error("Erro ao deletar NE:", error);
    }
    else { 
        showNotification('Nota de compra deletada com sucesso.'); 
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    }
}


function atualizarLabelsFormularioContato(prefixo = '') {
    const radioName = prefixo ? 'edit_tipo_pessoa' : 'tipo_pessoa';
    if (!document.querySelector(`input[name="${radioName}"]`)) return;
    const tipo = document.querySelector(`input[name="${radioName}"]:checked`).value;
    const labelNome = document.getElementById(`${prefixo}label-nome-contato`);
    const labelDocumento = document.getElementById(`${prefixo}label-documento-contato`);
    const inputNome = document.getElementById(`${prefixo}contato-nome`);
    const inputDocumento = document.getElementById(`${prefixo}contato-documento`);

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
    let contatosData = [];
    let notasFiscaisData = [];
    let notasEntradaData = [];
    let nfItens = [];
    let neItens = [];

    let currentPage = 1;
    let rowsPerPage = 20;
    let sortColumn = 'created_at';
    let sortDirection = 'desc';
    
    let currentPageEntrada = 1;
    let rowsPerPageEntrada = 20;
    let sortColumnEntrada = 'data_compra';
    let sortDirectionEntrada = 'desc';

    const navLinks = document.querySelectorAll('.nav-link');
    const telas = document.querySelectorAll('.main-content .tela');
    const modals = document.querySelectorAll('.modal');
    const formInsumos = document.getElementById('form-insumos');
    const formEditarInsumo = document.getElementById('form-editar-insumo');
    const formProdutos = document.getElementById('form-produtos');
    const formAdicionarIngrediente = document.getElementById('form-adicionar-ingrediente');
    const formContatos = document.getElementById('form-contatos');
    const formEditarContato = document.getElementById('form-editar-contato');
    const formAddNfItem = document.getElementById('form-add-nf-item');
    const formDadosNf = document.getElementById('form-dados-nf');
    const btnSalvarNf = document.getElementById('btn-salvar-nf');
    const formDadosNe = document.getElementById('form-dados-ne');
    const formAddNeItem = document.getElementById('form-add-ne-item');
    const btnSalvarNe = document.getElementById('btn-salvar-ne');
    const formEditAddNsItem = document.getElementById('form-edit-add-ns-item');
    const btnAtualizarNs = document.getElementById('btn-atualizar-ns');
    const formEditAddNeItem = document.getElementById('form-edit-add-ne-item');
    const btnAtualizarNe = document.getElementById('btn-atualizar-ne');

    function mostrarTela(targetId) {
        telas.forEach(tela => tela.classList.add('hidden'));
        const telaAlvo = document.getElementById(targetId);
        if (telaAlvo) telaAlvo.classList.remove('hidden');

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.target === targetId) {
                link.classList.add('active');
            }
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            mostrarTela(link.dataset.target);
        });
    });
    
    modals.forEach(modal => {
        const closeButton = modal.querySelector('.close-button');
        if (closeButton) {
            closeButton.onclick = () => modal.style.display = 'none';
        }
    });
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };

    document.querySelectorAll('.sub-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const parentNav = e.target.closest('.sub-nav');
            parentNav.querySelectorAll('.sub-nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            
            const parentTela = e.target.closest('.tela');
            parentTela.querySelectorAll('.subtela').forEach(s => s.classList.add('hidden'));
            document.getElementById(link.dataset.target).classList.remove('hidden');
        });
    });

function renderizarTabelaInsumos() {
    const corpoTabela = document.getElementById('corpo-tabela-insumos');
    corpoTabela.innerHTML = '';
    if (!insumosData || insumosData.length === 0) {
        corpoTabela.innerHTML = '<tr><td colspan="4">Nenhum insumo cadastrado.</td></tr>';
        return;
    }
    insumosData.forEach(insumo => {
        const tr = document.createElement('tr');
        const preco = insumo.preco_unitario ? Number(insumo.preco_unitario).toFixed(2) : '0.00';
        // Ajuste aqui para passar apenas o ID
        tr.innerHTML = `
            <td>${insumo.nome}</td>
            <td>${insumo.unidade_medida}</td>
            <td>R$ ${preco}</td>
            <td class="actions-container">
                <button class="btn-acao btn-warning" onclick="editarInsumo(${insumo.id})">✏️</button>
                <button class="btn-acao btn-danger" onclick="deletarInsumo(${insumo.id}, '${insumo.nome}')">🗑️</button>
            </td>
        `;
        corpoTabela.appendChild(tr);
    });
}

formInsumos.addEventListener('submit', async (event) => {
    event.preventDefault();

    const precoCompra = parseFloat(document.getElementById('preco-compra').value);
    const quantidadeCompra = parseFloat(document.getElementById('quantidade-compra').value);
    
    if (quantidadeCompra <= 0) {
        showNotification('A quantidade na embalagem deve ser maior que zero.', 'error');
        return;
    }

    // Calcula o preço por unidade de medida base
    const precoUnitarioCalculado = precoCompra / quantidadeCompra;

    const { error } = await supabaseClient.from('insumos').insert([{ 
        nome: document.getElementById('nome-insumo').value, 
        unidade_medida: document.getElementById('unidade-medida').value, 
        // Salva o preço calculado por unidade (g, ml, un)
        preco_unitario: precoUnitarioCalculado,
        nivel_minimo_estoque: document.getElementById('nivel_minimo_estoque').value
    }]);

    if (error) { 
        showNotification('Ocorreu um erro ao salvar.', 'error'); 
        console.error(error);
    } else { 
        showNotification('Insumo salvo com o preço unitário calculado!'); 
        formInsumos.reset(); 
        document.dispatchEvent(new CustomEvent('dadosAtualizados')); 
    }
});
    
// Em script.js
formEditarInsumo.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('edit-insumo-id').value;

    const precoCompra = parseFloat(document.getElementById('edit-preco-compra').value);
    const quantidadeCompra = parseFloat(document.getElementById('edit-quantidade-compra').value);

    let precoUnitarioFinal = parseFloat(document.getElementById('edit-preco-unitario').value);

    // Se o usuário preencheu os novos dados de compra, recalcula o preço unitário
    if (precoCompra && quantidadeCompra && quantidadeCompra > 0) {
        precoUnitarioFinal = precoCompra / quantidadeCompra;
        showNotification('Novo preço unitário calculado com base na compra!', 'info');
    }

    const dadosAtualizados = { 
        nome: document.getElementById('edit-nome-insumo').value, 
        unidade_medida: document.getElementById('edit-unidade-medida').value, 
        preco_unitario: precoUnitarioFinal,
        nivel_minimo_estoque: document.getElementById('edit-nivel_minimo_estoque').value
    };

    const { error } = await supabaseClient.from('insumos').update(dadosAtualizados).match({ id });

    if (error) { 
        showNotification('Não foi possível salvar as alterações.', 'error');
        console.error(error);
    } else { 
        showNotification('Insumo atualizado!'); 
        document.getElementById('modal-editar-insumo').style.display = 'none'; 
        document.dispatchEvent(new CustomEvent('dadosAtualizados')); 
    }
});

    formProdutos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabaseClient.from('produtos').insert([{ nome: document.getElementById('nome-produto').value }]);
        if (error) { showNotification('Erro ao salvar produto.', 'error'); } 
        else { showNotification('Produto salvo!'); formProdutos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    formAdicionarIngrediente.addEventListener('submit', async (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const { error } = await supabaseClient.from('receitas').insert([{ 
            produto_id: produtoId, 
            insumo_id: document.getElementById('select-insumo-receita').value, 
            quantidade: document.getElementById('quantidade-ingrediente').value 
        }]);
        if (error) { showNotification('Erro ao adicionar ingrediente.', 'error'); } 
        else { formAdicionarIngrediente.reset(); carregarIngredientesNoModal(produtoId); }
    });
    
    document.getElementById('btn-adicionar-custo').onclick = () => adicionarCampoDeCusto();
    document.getElementById('margem-lucro').addEventListener('input', recalcularAnaliseDeCustos);

    document.getElementById('btn-salvar-preco-venda').addEventListener('click', async () => {
        const produtoId = document.getElementById('gerenciar-produto-id').value;
        const precoFinal = document.getElementById('preco-final-definido').value;
        if (!precoFinal || precoFinal <= 0) { return showNotification('Defina um preço de venda válido.', 'error'); }
        const { error } = await supabaseClient.from('produtos').update({ preco_venda: precoFinal }).match({ id: produtoId });
        if (error) { showNotification('Erro ao salvar o preço.', 'error'); } 
        else { 
            showNotification('Preço de venda salvo com sucesso!');
            document.getElementById('modal-gerenciar-produto').style.display = 'none';
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
        }
    });

    function renderizarTabelaContatos() {
        const corpoTabela = document.getElementById('corpo-tabela-contatos');
        corpoTabela.innerHTML = '';
        if (!contatosData || contatosData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="4">Nenhum contato cadastrado.</td></tr>';
            return;
        }
        contatosData.forEach(contato => {
            const tr = document.createElement('tr');
            const papeis = parsePapeis(contato.papeis).join(', ');
            tr.innerHTML = `
                <td>${contato.nome_razao_social}</td>
                <td>${papeis}</td>
                <td>${contato.telefone || 'N/A'}</td>
                <td class="actions-container">
                    <button class="btn-acao btn-warning" onclick="editarContato(${contato.id})">✏️</button>
                    <button class="btn-acao btn-danger" onclick="deletarContato(${contato.id}, '${contato.nome_razao_social}')">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    document.querySelectorAll('input[name="tipo_pessoa"]').forEach(radio => {
        radio.addEventListener('change', () => atualizarLabelsFormularioContato());
    });
    document.querySelectorAll('input[name="edit_tipo_pessoa"]').forEach(radio => {
        radio.addEventListener('change', () => atualizarLabelsFormularioContato('edit-'));
    });

    formContatos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const papeis = [];
        if (document.getElementById('contato-e-cliente').checked) papeis.push('Cliente');
        if (document.getElementById('contato-e-fornecedor').checked) papeis.push('Fornecedor');

        const contato = {
            tipo_pessoa: document.querySelector('input[name="tipo_pessoa"]:checked').value,
            nome_razao_social: document.getElementById('contato-nome').value,
            cpf_cnpj: document.getElementById('contato-documento').value,
            telefone: document.getElementById('contato-telefone').value,
            email: document.getElementById('contato-email').value,
            endereco: document.getElementById('contato-endereco').value,
            papeis: papeis
        };
        const { error } = await supabaseClient.from('contatos').insert([contato]);
        if (error) { showNotification('Erro ao salvar contato.', 'error'); console.error(error); } 
        else { showNotification('Contato salvo com sucesso!'); formContatos.reset(); document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
    });

    formEditarContato.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('edit-contato-id').value;
        const papeis = [];
        if (document.getElementById('edit-contato-e-cliente').checked) papeis.push('Cliente');
        if (document.getElementById('edit-contato-e-fornecedor').checked) papeis.push('Fornecedor');

        const contato = {
            tipo_pessoa: document.querySelector('input[name="edit_tipo_pessoa"]:checked').value,
            nome_razao_social: document.getElementById('edit-contato-nome').value,
            cpf_cnpj: document.getElementById('edit-contato-documento').value,
            telefone: document.getElementById('edit-contato-telefone').value,
            email: document.getElementById('edit-contato-email').value,
            endereco: document.getElementById('edit-contato-endereco').value,
            papeis: papeis
        };
        const { error } = await supabaseClient.from('contatos').update(contato).match({ id });
        if (error) { showNotification('Erro ao atualizar contato.', 'error'); } 
        else { showNotification('Contato atualizado com sucesso!'); document.getElementById('modal-editar-contato').style.display = 'none'; document.dispatchEvent(new CustomEvent('dadosAtualizados')); }
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
                    <button type="button" class="btn-remover-ingrediente" onclick="removerItemNf(${index})">❌</button>
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
    
    function resetarFormularioNf() {
        nfItens = [];
        renderizarItensNf();
        formAddNfItem.reset();
        formDadosNf.reset();
    }

    formAddNfItem.addEventListener('submit', (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('nf-produto').value;
        if (!produtoId) return showNotification('Selecione um produto.', 'error');

        const produtoSelecionado = produtosData.find(p => p.id == produtoId);
        if (!produtoSelecionado.preco_venda) return showNotification('Este produto não foi precificado.', 'error');
        
        nfItens.push({
            produto_id: parseInt(produtoId, 10),
            nome: produtoSelecionado.nome,
            quantidade: parseFloat(document.getElementById('nf-quantidade').value),
            preco_unitario_momento: parseFloat(produtoSelecionado.preco_venda)
        });
        renderizarItensNf();
        formAddNfItem.reset();
        document.getElementById('nf-produto').focus();
    });

    btnSalvarNf.addEventListener('click', async () => {
        if (nfItens.length === 0) return showNotification('Adicione pelo menos um produto à nota.', 'error');
        const clienteId = document.getElementById('nf-cliente').value;
        if (!clienteId) return showNotification('Selecione um cliente.', 'error');

        const valorTotal = nfItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        
        const { data: notaFiscal, error } = await supabaseClient.from('notas_fiscais').insert([{
            cliente_id: parseInt(clienteId, 10),
            valor_total: valorTotal,
            status_pagamento: document.getElementById('nf-status-pagamento').value,
            metodo_pagamento: document.getElementById('nf-metodo-pagamento').value
        }]).select().single();

        if (error) {
            console.error('Erro ao salvar nota fiscal:', error);
            return showNotification('Erro ao salvar a nota fiscal.', 'error');
        }

        const itensParaSalvar = nfItens.map(item => ({
            nota_fiscal_id: notaFiscal.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario_momento: item.preco_unitario_momento
        }));

        const { error: errorItens } = await supabaseClient.from('nota_fiscal_itens').insert(itensParaSalvar);

        if (errorItens) {
            console.error('Erro ao salvar itens da nota:', errorItens);
            showNotification('Erro ao salvar os itens da nota. A nota principal foi criada mas está vazia.', 'error');
        } else {
            showNotification('Nota Fiscal salva com sucesso!');
            resetarFormularioNf();
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
            document.querySelector('#tela-notas-saida .sub-nav-link[data-target="subtela-historico-saida"]').click();
        }
    });

    function renderizarItensNe() {
        const container = document.getElementById('ne-itens-container');
        container.innerHTML = '';
        if (neItens.length === 0) {
            container.innerHTML = '<p class="placeholder">Adicione insumos à nota...</p>';
        } else {
            neItens.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'nf-item';
                itemDiv.innerHTML = `
                    <span>${item.quantidade} x ${item.nome} (R$ ${item.preco_unitario_momento.toFixed(2)})</span>
                    <strong>R$ ${(item.quantidade * item.preco_unitario_momento).toFixed(2)}</strong>
                    <button type="button" class="btn-remover-ingrediente" onclick="removerItemNe(${index})">❌</button>
                `;
                container.appendChild(itemDiv);
            });
        }
        const total = neItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        document.getElementById('ne-valor-total').textContent = `R$ ${total.toFixed(2)}`;
    }

    window.removerItemNe = function(index) {
        neItens.splice(index, 1);
        renderizarItensNe();
    }
    
    function resetarFormularioNe() {
        neItens = [];
        renderizarItensNe();
        formAddNeItem.reset();
        formDadosNe.reset();
        document.getElementById('ne-data').valueAsDate = new Date();
    }

// Em script.js, substitua o event listener do formAddNeItem
formAddNeItem.addEventListener('submit', (event) => {
    event.preventDefault();
    const insumoId = document.getElementById('ne-insumo').value;
    const insumoSelecionado = insumosData.find(i => i.id == insumoId);

    if (!insumoId || !insumoSelecionado) {
        return showNotification('Selecione um insumo válido.', 'error');
    }

    const quantidadeEmbalagens = parseFloat(document.getElementById('ne-quantidade').value);
    const precoPorEmbalagem = parseFloat(document.getElementById('ne-preco-pacote').value);
    const quantidadePorEmbalagem = parseFloat(document.getElementById('ne-quantidade-pacote').value);

    if (!quantidadeEmbalagens || !precoPorEmbalagem || !quantidadePorEmbalagem) {
        return showNotification('Preencha todos os campos da compra.', 'error');
    }

    // A quantidade a ser adicionada no estoque (na unidade base)
    const quantidadeTotalEmEstoque = quantidadeEmbalagens * quantidadePorEmbalagem;
    
    // O preço unitário do momento desta compra
    const precoUnitarioMomento = precoPorEmbalagem / quantidadePorEmbalagem;

    neItens.push({
        insumo_id: parseInt(insumoId, 10),
        nome: `${insumoSelecionado.nome} (${quantidadeEmbalagens}x ${quantidadePorEmbalagem}${insumoSelecionado.unidade_medida})`,
        // A 'quantidade' salva na nota de entrada agora é a quantidade na unidade base (g, ml, etc)
        quantidade: quantidadeTotalEmEstoque,
        preco_unitario_momento: precoUnitarioMomento
    });

    renderizarItensNe();
    formAddNeItem.reset();
    document.getElementById('ne-insumo').focus();
});

    btnSalvarNe.addEventListener('click', async () => {
        if (neItens.length === 0) return showNotification('Adicione pelo menos um insumo à nota.', 'error');
        const fornecedorId = document.getElementById('ne-fornecedor').value;
        const dataCompra = document.getElementById('ne-data').value;
        if (!fornecedorId || !dataCompra) return showNotification('Selecione um fornecedor e uma data.', 'error');

        const valorTotal = neItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);

        const { data: notaEntrada, error } = await supabaseClient.from('notas_entrada').insert([{
            fornecedor_id: parseInt(fornecedorId, 10),
            data_compra: dataCompra,
            valor_total: valorTotal
        }]).select().single();

        if (error) {
            console.error('Erro ao salvar nota de entrada:', error);
            return showNotification('Erro ao salvar a nota de compra.', 'error');
        }

        const itensParaSalvar = neItens.map(item => ({
            nota_entrada_id: notaEntrada.id,
            insumo_id: item.insumo_id,
            quantidade: item.quantidade,
            preco_unitario_momento: item.preco_unitario_momento
        }));

        const { error: errorItens } = await supabaseClient.from('nota_entrada_itens').insert(itensParaSalvar);

        if (errorItens) {
            console.error('Erro ao salvar itens da nota de entrada:', errorItens);
            showNotification('Erro ao salvar os insumos da nota. A nota principal foi criada mas está vazia.', 'error');
        } else {
            showNotification('Nota de Compra salva com sucesso!');
            resetarFormularioNe();
            document.dispatchEvent(new CustomEvent('dadosAtualizados'));
            document.querySelector('#tela-notas-entrada .sub-nav-link[data-target="subtela-historico-entrada"]').click();
        }
    });
    
    function displayNotasFiscais() {
        const corpoTabela = document.getElementById('corpo-tabela-notas-saida');
        if (!corpoTabela) return;
        corpoTabela.innerHTML = '';

        const filtroBusca = document.getElementById('filtro-busca').value.toLowerCase();
        const filtroDataInicio = document.getElementById('filtro-data-inicio').value;
        const filtroDataFim = document.getElementById('filtro-data-fim').value;

        const filteredData = notasFiscaisData.filter(nf => {
            const buscaCliente = nf.contatos?.nome_razao_social.toLowerCase().includes(filtroBusca);
            const buscaId = nf.id.toString().includes(filtroBusca);
            
            const dataNota = new Date(nf.created_at);
            dataNota.setHours(0,0,0,0);
            const dataInicio = filtroDataInicio ? new Date(filtroDataInicio + 'T00:00:00Z') : null;
            const dataFim = filtroDataFim ? new Date(filtroDataFim + 'T23:59:59Z') : null;

            const atendeBusca = filtroBusca ? (buscaCliente || buscaId) : true;
            const atendeDataInicio = dataInicio ? dataNota >= dataInicio : true;
            const atendeDataFim = dataFim ? dataNota <= dataFim : true;

            return atendeBusca && atendeDataInicio && atendeDataFim;
        });

        filteredData.sort((a, b) => {
            let valA, valB;
            if (sortColumn === 'cliente') {
                valA = a.contatos?.nome_razao_social.toLowerCase() || '';
                valB = b.contatos?.nome_razao_social.toLowerCase() || '';
            } else {
                valA = a[sortColumn];
                valB = b[sortColumn];
            }
            
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        if (paginatedData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="5">Nenhuma nota fiscal encontrada com os filtros atuais.</td></tr>';
        } else {
            renderizarTabelaNotasFiscais(paginatedData);
        }

        renderizarPaginacao(filteredData.length);
        atualizarCabecalhoOrdenacao();
    }

    function renderizarTabelaNotasFiscais(notas) {
        const corpoTabela = document.getElementById('corpo-tabela-notas-saida');
        corpoTabela.innerHTML = ''; 
        notas.forEach(nf => {
            const tr = document.createElement('tr');
            const statusClass = nf.status_pagamento === 'Pago' ? 'status-pago' : 'status-pendente';
            tr.innerHTML = `
                <td>${new Date(nf.created_at).toLocaleDateString('pt-BR')}</td>
                <td>${nf.contatos ? nf.contatos.nome_razao_social : 'Cliente removido'}</td>
                <td>R$ ${Number(nf.valor_total).toFixed(2)}</td>
                <td><span class="status ${statusClass}">${nf.status_pagamento}</span></td>
                <td class="actions-container">
                    <button class="btn-acao btn-info" title="Ver Detalhes" onclick="verDetalhesNota(${nf.id})">👁️</button>
                    <button class="btn-acao btn-warning" title="Editar Nota" onclick="editarNotaSaida(${nf.id})">✏️</button>
                    ${nf.status_pagamento !== 'Pago' ? `<button class="btn-acao btn-success" title="Marcar como Pago" onclick="marcarComoPago(${nf.id})">✔️</button>` : ''}
                    <button class="btn-acao btn-danger" title="Deletar Nota" onclick="deletarNota(${nf.id})">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    function renderizarPaginacao(totalItens) {
        const container = document.getElementById('paginacao-botoes');
        const infoContainer = document.getElementById('total-itens-info');
        if (!container || !infoContainer) return;
        container.innerHTML = '';
        infoContainer.textContent = `(Total: ${totalItens})`;

        const totalPages = Math.ceil(totalItens / rowsPerPage);
        if (totalPages <= 1) return;

        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            if (i === currentPage) button.classList.add('active');
            button.addEventListener('click', () => {
                currentPage = i;
                displayNotasFiscais();
            });
            container.appendChild(button);
        }
    }
    
    function atualizarCabecalhoOrdenacao() {
        document.querySelectorAll('#tela-notas-saida th.sortable').forEach(th => {
            const span = th.querySelector('span');
            if(!span) return;
            span.textContent = '';
            if (th.dataset.sort === sortColumn) {
                span.textContent = sortDirection === 'asc' ? '▲' : '▼';
            }
        });
    }

    document.getElementById('filtro-busca').addEventListener('input', () => { currentPage = 1; displayNotasFiscais(); });
    document.getElementById('filtro-data-inicio').addEventListener('change', () => { currentPage = 1; displayNotasFiscais(); });
    document.getElementById('filtro-data-fim').addEventListener('change', () => { currentPage = 1; displayNotasFiscais(); });
    document.getElementById('rows-per-page').addEventListener('change', (e) => {
        currentPage = 1;
        rowsPerPage = parseInt(e.target.value, 10);
        displayNotasFiscais();
    });
    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
        document.getElementById('filtro-busca').value = '';
        document.getElementById('filtro-data-inicio').value = '';
        document.getElementById('filtro-data-fim').value = '';
        currentPage = 1;
        sortColumn = 'created_at';
        sortDirection = 'desc';
        displayNotasFiscais();
    });
    document.querySelectorAll('#tela-notas-saida th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const newSortColumn = th.dataset.sort;
            if (sortColumn === newSortColumn) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = newSortColumn;
                sortDirection = 'asc';
            }
            currentPage = 1;
            displayNotasFiscais();
        });
    });

    formEditAddNsItem.addEventListener('submit', (event) => {
        event.preventDefault();
        const produtoId = document.getElementById('edit-ns-produto').value;
        if (!produtoId) return showNotification('Selecione um produto.', 'error');

        const produtoSelecionado = produtosData.find(p => p.id == produtoId);
        if (!produtoSelecionado.preco_venda) return showNotification('Este produto não foi precificado.', 'error');
        
        editNsItens.push({
            produto_id: parseInt(produtoId, 10),
            nome: produtoSelecionado.nome,
            quantidade: parseFloat(document.getElementById('edit-ns-quantidade').value),
            preco_unitario_momento: parseFloat(produtoSelecionado.preco_venda)
        });
        renderizarItensNs();
        event.target.reset();
    });

    btnAtualizarNs.addEventListener('click', async () => {
        const notaId = document.getElementById('edit-ns-hidden-id').value;
        if (!notaId) return;

        if (editNsItens.length === 0) return showNotification('A nota não pode ficar sem itens.', 'error');

        const valorTotal = editNsItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        
        const { error: updateError } = await supabaseClient.from('notas_fiscais').update({
            cliente_id: document.getElementById('edit-ns-cliente').value,
            metodo_pagamento: document.getElementById('edit-ns-metodo-pagamento').value,
            status_pagamento: document.getElementById('edit-ns-status-pagamento').value,
            valor_total: valorTotal
        }).match({ id: notaId });

        if (updateError) {
            console.error("Erro ao atualizar a nota:", updateError);
            return showNotification('Falha ao atualizar a nota.', 'error');
        }

        const { error: deleteError } = await supabaseClient.from('nota_fiscal_itens').delete().match({ nota_fiscal_id: notaId });
        if (deleteError) {
            console.error("Erro ao deletar itens antigos:", deleteError);
            return showNotification('Falha ao limpar itens antigos.', 'error');
        }

        const novosItensParaSalvar = editNsItens.map(item => ({
            nota_fiscal_id: notaId,
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            preco_unitario_momento: item.preco_unitario_momento
        }));

        const { error: insertError } = await supabaseClient.from('nota_fiscal_itens').insert(novosItensParaSalvar);
        
        if (insertError) {
            console.error("Erro ao inserir novos itens:", insertError);
            return showNotification('Falha ao salvar os novos itens.', 'error');
        }

        showNotification('Nota de Venda atualizada com sucesso!');
        document.getElementById('modal-editar-nota-saida').style.display = 'none';
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    });

    formEditAddNeItem.addEventListener('submit', (event) => {
        event.preventDefault();
        const insumoId = document.getElementById('edit-ne-insumo').value;
        const preco = parseFloat(document.getElementById('edit-ne-preco').value);

        if (!insumoId || !preco || preco <= 0) {
            return showNotification('Selecione um insumo e preencha um preço válido.', 'error');
        }
        
        const insumoSelecionado = insumosData.find(i => i.id == insumoId);
        
        editNeItens.push({
            insumo_id: parseInt(insumoId, 10),
            nome: insumoSelecionado.nome,
            quantidade: parseFloat(document.getElementById('edit-ne-quantidade').value),
            preco_unitario_momento: preco
        });
        renderizarItensNeEdicao();
        event.target.reset();
    });

    btnAtualizarNe.addEventListener('click', async () => {
        const notaId = document.getElementById('edit-ne-hidden-id').value;
        if (!notaId) return;

        if (editNeItens.length === 0) return showNotification('A nota de compra não pode ficar sem insumos.', 'error');

        const valorTotal = editNeItens.reduce((acc, item) => acc + (item.quantidade * item.preco_unitario_momento), 0);
        
        const { error: updateError } = await supabaseClient.from('notas_entrada').update({
            fornecedor_id: document.getElementById('edit-ne-fornecedor').value,
            data_compra: document.getElementById('edit-ne-data').value,
            valor_total: valorTotal
        }).match({ id: notaId });

        if (updateError) {
            console.error("Erro ao atualizar a nota de compra:", updateError);
            return showNotification('Falha ao atualizar a nota de compra.', 'error');
        }

        const { error: deleteError } = await supabaseClient.from('nota_entrada_itens').delete().match({ nota_entrada_id: notaId });
        if (deleteError) {
            console.error("Erro ao deletar insumos antigos:", deleteError);
            return showNotification('Falha ao limpar insumos antigos.', 'error');
        }

        const novosItensParaSalvar = editNeItens.map(item => ({
            nota_entrada_id: notaId,
            insumo_id: item.insumo_id,
            quantidade: item.quantidade,
            preco_unitario_momento: item.preco_unitario_momento
        }));

        const { error: insertError } = await supabaseClient.from('nota_entrada_itens').insert(novosItensParaSalvar);
        
        if (insertError) {
            console.error("Erro ao inserir novos insumos:", insertError);
            return showNotification('Falha ao salvar os novos insumos.', 'error');
        }

        showNotification('Nota de Compra atualizada com sucesso!');
        document.getElementById('modal-editar-nota-entrada').style.display = 'none';
        document.dispatchEvent(new CustomEvent('dadosAtualizados'));
    });

    async function atualizarTodosOsDados() {
        try {
            const [insumosResult, produtosResult, contatosResult, notasSaidaResult, notasEntradaResult] = await Promise.all([
                supabaseClient.from('insumos').select('*').order('nome'),
                supabaseClient.from('produtos').select('*').order('nome'),
                supabaseClient.from('contatos').select('*').order('nome_razao_social'),
                supabaseClient.from('notas_fiscais').select(`*, contatos(nome_razao_social)`),
                supabaseClient.from('notas_entrada').select(`*, contatos(nome_razao_social)`)
            ]);
            
            insumosData = insumosResult.data || [];
            produtosData = produtosResult.data || [];
            contatosData = contatosResult.data || [];
            notasFiscaisData = notasSaidaResult.data || [];
            notasEntradaData = notasEntradaResult.data || [];
            
            renderizarTabelaInsumos();
            renderizarTabelaProdutos();
            renderizarTabelaContatos();
            
            const selectors = {
                selectInsumo: document.getElementById('select-insumo-receita'),
                selectProdutoNf: document.getElementById('nf-produto'),
                selectClienteNf: document.getElementById('nf-cliente'),
                selectNeInsumo: document.getElementById('ne-insumo'),
                selectNeFornecedor: document.getElementById('ne-fornecedor'),
                editNsCliente: document.getElementById('edit-ns-cliente'),
                editNsProduto: document.getElementById('edit-ns-produto'),
                editNeFornecedor: document.getElementById('edit-ne-fornecedor'),
                editNeInsumo: document.getElementById('edit-ne-insumo')
            };
            
            Object.values(selectors).forEach(sel => { if(sel) sel.innerHTML = ''; });
            
            const optionTemplates = {
                insumo: '<option value="">Selecione...</option>',
                produto: '<option value="">Selecione um produto...</option>',
                cliente: '<option value="">Selecione um cliente...</option>',
                fornecedor: '<option value="">Selecione um fornecedor...</option>'
            };

            Object.assign(selectors.selectInsumo, { innerHTML: optionTemplates.insumo });
            Object.assign(selectors.selectProdutoNf, { innerHTML: optionTemplates.produto });
            Object.assign(selectors.selectClienteNf, { innerHTML: optionTemplates.cliente });
            Object.assign(selectors.selectNeInsumo, { innerHTML: optionTemplates.insumo });
            Object.assign(selectors.selectNeFornecedor, { innerHTML: optionTemplates.fornecedor });
            Object.assign(selectors.editNsCliente, { innerHTML: optionTemplates.cliente });
            Object.assign(selectors.editNsProduto, { innerHTML: optionTemplates.produto });
            Object.assign(selectors.editNeFornecedor, { innerHTML: optionTemplates.fornecedor });
            Object.assign(selectors.editNeInsumo, { innerHTML: optionTemplates.insumo });
            
            insumosData.forEach(i => {
                const option = `<option value="${i.id}">${i.nome}</option>`;
                selectors.selectInsumo.innerHTML += option;
                selectors.selectNeInsumo.innerHTML += option;
                selectors.editNeInsumo.innerHTML += option;
            });

            produtosData.filter(p => p.preco_venda > 0).forEach(p => {
                const option = `<option value="${p.id}">${p.nome} - R$ ${Number(p.preco_venda).toFixed(2)}</option>`;
                selectors.selectProdutoNf.innerHTML += option;
                selectors.editNsProduto.innerHTML += option;
            });
            
            const clientes = contatosData.filter(c => parsePapeis(c.papeis).includes('Cliente'));
            clientes.forEach(c => {
                const option = `<option value="${c.id}">${c.nome_razao_social}</option>`;
                selectors.selectClienteNf.innerHTML += option;
                selectors.editNsCliente.innerHTML += option;
            });

            const fornecedores = contatosData.filter(c => parsePapeis(c.papeis).includes('Fornecedor'));
            fornecedores.forEach(f => {
                const option = `<option value="${f.id}">${f.nome_razao_social}</option>`;
                selectors.selectNeFornecedor.innerHTML += option;
                selectors.editNeFornecedor.innerHTML += option;
            });
            
            document.getElementById('ne-data').valueAsDate = new Date();
            
            displayNotasFiscais();
            displayNotasEntrada();
        } catch (error) {
            console.error("Falha ao carregar dados iniciais:", error);
            showNotification("ERRO CRÍTICO: Não foi possível carregar os dados. Verifique a conexão e a chave do Supabase.", "error");
        }
    }
    
    document.addEventListener('dadosAtualizados', atualizarTodosOsDados);
    
    mostrarTela('tela-dashboard');
    atualizarTodosOsDados();
    atualizarLabelsFormularioContato();

    function displayNotasEntrada() {
        const corpoTabela = document.getElementById('corpo-tabela-notas-entrada');
        if (!corpoTabela) return;
        corpoTabela.innerHTML = '';

        const filtroBusca = document.getElementById('filtro-busca-entrada').value.toLowerCase();
        const filtroDataInicio = document.getElementById('filtro-data-inicio-entrada').value;
        const filtroDataFim = document.getElementById('filtro-data-fim-entrada').value;

        const filteredData = notasEntradaData.filter(ne => {
            const buscaFornecedor = ne.contatos?.nome_razao_social.toLowerCase().includes(filtroBusca);
            const buscaId = ne.id.toString().includes(filtroBusca);
            
            const dataNota = new Date(ne.data_compra);
            const dataInicio = filtroDataInicio ? new Date(filtroDataInicio) : null;
            const dataFim = filtroDataFim ? new Date(filtroDataFim) : null;

            const atendeBusca = filtroBusca ? (buscaFornecedor || buscaId) : true;
            const atendeDataInicio = dataInicio ? dataNota >= dataInicio : true;
            const atendeDataFim = dataFim ? dataNota <= dataFim : true;

            return atendeBusca && atendeDataInicio && atendeDataFim;
        });

        filteredData.sort((a, b) => {
            let valA, valB;
            if (sortColumnEntrada === 'fornecedor') {
                valA = a.contatos?.nome_razao_social.toLowerCase() || '';
                valB = b.contatos?.nome_razao_social.toLowerCase() || '';
            } else {
                valA = a[sortColumnEntrada];
                valB = b[sortColumnEntrada];
            }
            
            if (valA < valB) return sortDirectionEntrada === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirectionEntrada === 'asc' ? 1 : -1;
            return 0;
        });

        const startIndex = (currentPageEntrada - 1) * rowsPerPageEntrada;
        const endIndex = startIndex + rowsPerPageEntrada;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        if (paginatedData.length === 0) {
            corpoTabela.innerHTML = '<tr><td colspan="4">Nenhuma nota de compra encontrada.</td></tr>';
        } else {
            renderizarTabelaNotasEntrada(paginatedData);
        }

        renderizarPaginacaoEntrada(filteredData.length);
        atualizarCabecalhoOrdenacaoEntrada();
    }

    function renderizarTabelaNotasEntrada(notas) {
        const corpoTabela = document.getElementById('corpo-tabela-notas-entrada');
        corpoTabela.innerHTML = ''; 
        notas.forEach(ne => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(ne.data_compra).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                <td>${ne.contatos ? ne.contatos.nome_razao_social : 'Fornecedor removido'}</td>
                <td>R$ ${Number(ne.valor_total).toFixed(2)}</td>
                <td class="actions-container">
                    <button class="btn-acao btn-info" title="Ver Detalhes" onclick="verDetalhesNotaEntrada(${ne.id})">👁️</button>
                    <button class="btn-acao btn-warning" title="Editar Nota" onclick="editarNotaEntrada(${ne.id})">✏️</button>
                    <button class="btn-acao btn-danger" title="Deletar Nota" onclick="deletarNotaEntrada(${ne.id})">🗑️</button>
                </td>
            `;
            corpoTabela.appendChild(tr);
        });
    }

    function renderizarPaginacaoEntrada(totalItens) {
        const container = document.getElementById('paginacao-botoes-entrada');
        const infoContainer = document.getElementById('total-itens-info-entrada');
        if (!container || !infoContainer) return;
        container.innerHTML = '';
        infoContainer.textContent = `(Total: ${totalItens})`;

        const totalPages = Math.ceil(totalItens / rowsPerPageEntrada);
        if (totalPages <= 1) return;

        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            if (i === currentPageEntrada) button.classList.add('active');
            button.addEventListener('click', () => {
                currentPageEntrada = i;
                displayNotasEntrada();
            });
            container.appendChild(button);
        }
    }
    
    function atualizarCabecalhoOrdenacaoEntrada() {
        document.querySelectorAll('#subtela-historico-entrada th.sortable').forEach(th => {
            const span = th.querySelector('span');
            if(!span) return;
            span.textContent = '';
            if (th.dataset.sortEntrada === sortColumnEntrada) {
                span.textContent = sortDirectionEntrada === 'asc' ? '▲' : '▼';
            }
        });
    }
    
    document.getElementById('filtro-busca-entrada').addEventListener('input', () => { currentPageEntrada = 1; displayNotasEntrada(); });
    document.getElementById('filtro-data-inicio-entrada').addEventListener('change', () => { currentPageEntrada = 1; displayNotasEntrada(); });
    document.getElementById('filtro-data-fim-entrada').addEventListener('change', () => { currentPageEntrada = 1; displayNotasEntrada(); });
    document.getElementById('rows-per-page-entrada').addEventListener('change', (e) => {
        currentPageEntrada = 1;
        rowsPerPageEntrada = parseInt(e.target.value, 10);
        displayNotasEntrada();
    });
    document.getElementById('btn-limpar-filtros-entrada').addEventListener('click', () => {
        document.getElementById('filtro-busca-entrada').value = '';
        document.getElementById('filtro-data-inicio-entrada').value = '';
        document.getElementById('filtro-data-fim-entrada').value = '';
        currentPageEntrada = 1;
        sortColumnEntrada = 'data_compra';
        sortDirectionEntrada = 'desc';
        displayNotasEntrada();
    });
    document.querySelectorAll('#subtela-historico-entrada th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const newSortColumn = th.dataset.sortEntrada;
            if (sortColumnEntrada === newSortColumn) {
                sortDirectionEntrada = sortDirectionEntrada === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumnEntrada = newSortColumn;
                sortDirectionEntrada = 'asc';
            }
            currentPageEntrada = 1;
            displayNotasEntrada();
        });
    });
});