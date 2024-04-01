import { networkInterfaces } from 'os';
import http from 'http';
import axios from 'axios';
import moment from 'moment'

//-----------------------------------------------------
//-----------CONFIG------------------------------------
let token = "meu-token-cloud-flare";  // 
let zone_id = "zone-id-do-dominio";//fica na home a direitana a baixo.
let timeVerify = 1;//tempo de verificação do dns em segundos.
let dominios = [
    { dominio: 'sub.exemplo.com.br', proxy: false},
    { dominio: 'sub2.exemplo.com.br', proxy: true}
]
//-----------------------------------------------------

let lastQueryCloudFlareDNS = null;


function getIPv6Addresses() {
    const interfaces = networkInterfaces();
    const ipv6Addresses = [];

    Object.keys(interfaces).forEach((interfaceName) => {
        interfaces[interfaceName].forEach((iface) => {
            if (iface.family === 'IPv6' && !iface.internal) {
                ipv6Addresses.push(iface.address);
            }
        });
    });

    return ipv6Addresses;
}

function testIPv6Connection(ipv6Address) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'ipv6.google.com',
            port: 80,
            family: 6,
            localAddress: ipv6Address, // Aqui especificamos o endereço IPv6 que queremos testar
        };

        const req = http.request(options, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                reject(false);
            }
        });

        req.on('error', (err) => {
            reject(false);
        });

        req.end();
    });
}


async function verificaIPV6valid() {
    const ipv6Addresses = getIPv6Addresses();

    if (ipv6Addresses.length === 0) {
        console.error('Não foi possível encontrar um endereço IPv6 válido.');
        return;
    }

    //console.log('Endereços IPv6 identificados:', ipv6Addresses);

    let ipv6Valid = "";
    for (const ipv6Address of ipv6Addresses) {
        try {
            await testIPv6Connection(ipv6Address);
            ipv6Valid = ipv6Address;
            break;
            console.log('Teste de conexão bem-sucedido. O endereço IPv6 confirmado é:', confirmedIPv6Address);
            // Se desejar parar após encontrar o primeiro endereço válido, descomente a linha abaixo
            // break;
        } catch (error) {
            // console.error('Erro ao testar a conexão IPv6 para o endereço', ipv6Address, ':', error.message);
        }
    }

    return ipv6Valid
}

async function main() {
     let ipv6 = await verificaIPV6valid();

    try {
       
        if (lastQueryCloudFlareDNS == null) {
            lastQueryCloudFlareDNS = await consultarDNSApiCloudFlare();
        }
        let isChanged = false;

        for (const registro of lastQueryCloudFlareDNS.result) {
            let dominio = dominios.find((item) => item.dominio == registro.name)
            if (dominio) {
                if (registro.content != ipv6) {
                    editarDNSApiCloudFlare(ipv6, dominio.name, dominio.proxy, `Atualizado em ${moment()}`, registro.id);
                    isChanged = true;

                }
            }
        }

        if (isChanged == true) { lastQueryCloudFlareDNS = await consultarDNSApiCloudFlare() }



    } catch (error) {
        console.error('Erro :', error.message);
    }
    console.log('verificado em ', moment().format("HH:mm:ss"), `ipv6 valid: ${ipv6}`)
    setTimeout(main, timeVerify * 1000);

}




async function consultarDNSApiCloudFlare() {
    console.log('Consultou na cloudflare');
    let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: `https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        }
    };

    let response = await axios.request(config);
    return response.data;

}

async function editarDNSApiCloudFlare(ip, name, proxied, comment, id_register) {
  
    let data = JSON.stringify({
        "content": ip,
        "name": name,
        "proxied": proxied,
        "type": "AAAA",
        "comment": comment,
        "ttl": 3600
    });

    let config = {
        method: 'patch',
        maxBodyLength: Infinity,
        url: `https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records/${id_register}`,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        data: data
    };

    let response = await axios.request(config);
    return response

}

main();